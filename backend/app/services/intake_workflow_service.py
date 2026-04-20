"""Automated triggers for the client intake workflow.

Implements the three-stage approval workflow:
  1. RM creates / submits client intake → compliance team notified
  2. Compliance clears/flags/rejects  → MD or RM notified
  3. MD approves                       → clearance certificate generated,
                                         welcome communication dispatched,
                                         welcome_email_sent flagged
"""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client_profile import ClientProfile
from app.models.enums import ComplianceStatus, UserRole
from app.models.user import User
from app.schemas.notification import CreateNotificationRequest
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _get_users_by_role(db: AsyncSession, role: UserRole) -> list[User]:
    """Return all active users with *role*."""
    result = await db.execute(select(User).where(User.role == role.value, User.status == "active"))
    return list(result.scalars().all())


def _client_name(profile: ClientProfile) -> str:
    return profile.display_name or profile.legal_name


# ---------------------------------------------------------------------------
# Trigger 1 — intake submitted
# ---------------------------------------------------------------------------


async def on_intake_created(db: AsyncSession, profile: ClientProfile) -> None:
    """Notify all ``finance_compliance`` users that a new profile needs review.

    Called immediately after an RM creates or submits a client intake form.
    The profile must already have ``compliance_status = 'pending_review'`` and
    ``approval_status = 'pending_compliance'`` set before this is invoked.
    """
    compliance_users = await _get_users_by_role(db, UserRole.finance_compliance)

    if not compliance_users:
        logger.warning(
            "No active finance_compliance users found — "
            "compliance notification skipped for profile %s",
            profile.id,
        )
        return

    name = _client_name(profile)
    for user in compliance_users:
        await notification_service.create_notification(
            db,
            CreateNotificationRequest(
                user_id=user.id,
                notification_type="compliance_review_required",
                title="New client profile requires compliance review",
                body=(
                    f"Client profile for '{name}' has been submitted "
                    "and requires your compliance review."
                ),
                action_url=f"/clients/{profile.id}",
                action_label="Review Profile",
                entity_type="client_profile",
                entity_id=profile.id,
                priority="high",
            ),
        )

    logger.info(
        "Notified %d compliance user(s) of new intake for profile %s",
        len(compliance_users),
        profile.id,
    )


# ---------------------------------------------------------------------------
# Trigger 2 — compliance review complete
# ---------------------------------------------------------------------------


async def on_compliance_reviewed(
    db: AsyncSession,
    profile: ClientProfile,
    review_status: str,
) -> None:
    """React to a completed compliance review.

    * ``cleared``  → notify all ``managing_director`` users for MD approval.
    * ``flagged``
      ``rejected`` → notify the assigned RM (or profile creator if unassigned).
    """
    name = _client_name(profile)

    if review_status == ComplianceStatus.cleared:
        md_users = await _get_users_by_role(db, UserRole.managing_director)

        if not md_users:
            logger.warning(
                "No active managing_director users found — "
                "MD approval notification skipped for profile %s",
                profile.id,
            )
            return

        for user in md_users:
            await notification_service.create_notification(
                db,
                CreateNotificationRequest(
                    user_id=user.id,
                    notification_type="md_approval_required",
                    title="Client profile cleared by compliance, awaiting MD approval",
                    body=(
                        f"Client profile for '{name}' has been cleared by compliance "
                        "and is awaiting your approval."
                    ),
                    action_url=f"/clients/{profile.id}",
                    action_label="Review & Approve",
                    entity_type="client_profile",
                    entity_id=profile.id,
                    priority="high",
                ),
            )

        logger.info(
            "Notified %d MD user(s) of compliance clearance for profile %s",
            len(md_users),
            profile.id,
        )

    elif review_status in (ComplianceStatus.flagged, ComplianceStatus.rejected):
        rm_id: uuid.UUID = profile.assigned_rm_id or profile.created_by
        action = "flagged" if review_status == ComplianceStatus.flagged else "rejected"

        await notification_service.create_notification(
            db,
            CreateNotificationRequest(
                user_id=rm_id,
                notification_type="compliance_review_completed",
                title=f"Client profile {action} by compliance",
                body=(
                    f"Client profile for '{name}' has been {action} during compliance review. "
                    "Please review the compliance notes and take appropriate action."
                ),
                action_url=f"/clients/{profile.id}",
                action_label="View Profile",
                entity_type="client_profile",
                entity_id=profile.id,
                priority="high",
            ),
        )

        logger.info(
            "Notified RM %s of %s compliance outcome for profile %s",
            rm_id,
            review_status,
            profile.id,
        )


# ---------------------------------------------------------------------------
# Trigger 3 — MD approval
# ---------------------------------------------------------------------------


async def on_md_approved(
    db: AsyncSession,
    profile: ClientProfile,
    approver_id: uuid.UUID,
) -> None:
    """React to MD approval of a client profile.

    Steps (each attempted independently so a partial failure does not abort):
    1. Auto-generate a persisted clearance certificate (best-effort; requires
       a ``Client`` record linked to the profile's assigned RM).
    2. Dispatch the ``welcome`` template to the client's portal user (if the
       user account has already been provisioned via ``/provision``).
    3. Set ``welcome_email_sent = True`` when ``portal_access_enabled`` is
       already ``True`` on the profile.
    """
    await _generate_clearance_certificate(db, profile, approver_id)
    await _dispatch_welcome_communication(db, profile)

    if profile.portal_access_enabled and not profile.welcome_email_sent:
        profile.welcome_email_sent = True
        await db.commit()
        await db.refresh(profile)
        logger.info("Set welcome_email_sent=True for profile %s", profile.id)


async def _generate_clearance_certificate(
    db: AsyncSession,
    profile: ClientProfile,
    approver_id: uuid.UUID,
) -> None:
    """Generate and immediately issue a PDF compliance clearance certificate.

    Uses ``auto_generate_compliance_clearance_certificate`` which creates the
    certificate in "issued" status and stores the PDF in MinIO in a single
    step.  The resulting certificate ID and PDF path are written back to the
    ``ClientProfile`` so the file can be retrieved or attached to emails.

    The ``ClearanceCertificate`` model requires a FK reference to the
    ``clients`` table.  A ``Client`` record is looked up via the RM assigned
    to this profile.  If no matching ``Client`` is found the call is skipped.
    """
    try:
        from app.models.client import Client
        from app.services.certificate_service import certificate_service

        # Resolve the approver User record
        approver_result = await db.execute(select(User).where(User.id == approver_id))
        approver = approver_result.scalar_one_or_none()
        if not approver:
            logger.warning(
                "Approver %s not found — clearance certificate skipped for profile %s",
                approver_id,
                profile.id,
            )
            return

        # Find a Client record managed by the assigned RM (or profile creator)
        rm_id = profile.assigned_rm_id or profile.created_by
        client_result = await db.execute(
            select(Client).where(Client.rm_id == rm_id).order_by(Client.created_at.desc()).limit(1)
        )
        client = client_result.scalar_one_or_none()

        if not client:
            logger.info(
                "No linked Client record found for RM %s — "
                "clearance certificate deferred for profile %s. "
                "In-memory certificate available via /clients/%s/compliance-certificate.",
                rm_id,
                profile.id,
                profile.id,
            )
            return

        # Build profile data for the certificate template
        reviewed_at_str = (
            profile.compliance_reviewed_at.strftime("%Y-%m-%d %H:%M UTC")
            if profile.compliance_reviewed_at
            else None
        )
        profile_data = {
            "client_name": _client_name(profile),
            "client_legal_name": profile.legal_name,
            "entity_type": profile.entity_type,
            "jurisdiction": profile.jurisdiction,
            "reviewed_by_name": approver.full_name,
            "reviewed_at": reviewed_at_str,
            "review_notes": profile.compliance_notes,
        }

        cert = await certificate_service.auto_generate_compliance_clearance_certificate(
            db=db,
            client_id=client.id,
            reviewer=approver,
            profile_data=profile_data,
        )

        if cert is None:
            logger.warning(
                "auto_generate_compliance_clearance_certificate returned None for profile %s",
                profile.id,
            )
            return

        # Attach the certificate to the profile
        profile.compliance_certificate_id = cert.id
        profile.compliance_certificate_path = cert.pdf_path
        await db.commit()
        await db.refresh(profile)

        logger.info(
            "Issued compliance clearance certificate %s (PDF: %s) for profile %s (client %s)",
            cert.certificate_number,
            cert.pdf_path,
            profile.id,
            client.id,
        )
    except Exception:
        logger.exception(
            "Failed to auto-generate clearance certificate for profile %s — "
            "continuing with remainder of approval workflow",
            profile.id,
        )


async def _dispatch_welcome_communication(
    db: AsyncSession,
    profile: ClientProfile,
) -> None:
    """Dispatch the ``welcome`` template and send the welcome email with certificate PDF.

    Two actions are performed:
    1. Dispatch the in-app ``welcome`` communication template (if the portal
       user has been provisioned).
    2. Send a welcome email with the compliance clearance certificate PDF
       attached (via ``send_email_with_attachment``).  Falls back to a plain
       welcome email when no certificate PDF is available.
    """
    from app.services.auto_dispatch_service import dispatch_template_message

    name = _client_name(profile)

    # 1. In-app welcome communication (requires a provisioned portal user)
    if profile.user_id:
        await dispatch_template_message(
            db,
            template_type="welcome",
            recipient_user_ids=[profile.user_id],
            variables={
                "client_name": name,
                "legal_name": profile.legal_name,
                "portal_url": "/dashboard",
            },
            client_id=profile.id,
        )
        logger.info(
            "Dispatched welcome communication to user %s for profile %s",
            profile.user_id,
            profile.id,
        )
    else:
        logger.info(
            "Profile %s has no portal user provisioned yet — "
            "in-app welcome communication deferred until provisioning.",
            profile.id,
        )

    # 2. Welcome email — attach certificate PDF when available
    await _send_welcome_email_with_certificate(profile, name)


async def _send_welcome_email_with_certificate(
    profile: ClientProfile,
    client_name: str,
) -> None:
    """Send a welcome email to the client, attaching the compliance certificate PDF.

    When a PDF path is stored on the profile the bytes are fetched from MinIO
    and sent as an attachment via ``send_email_with_attachment``.  If the PDF
    is not available yet a plain welcome email is sent instead.
    """
    from app.core.config import settings
    from app.services.email_service import send_email, send_email_with_attachment

    body_html = f"""
<html>
  <body style="font-family: Georgia, serif; color: #2c2c2c; max-width: 600px; margin: auto;">
    <h2 style="color: #8B4513;">Welcome to AMG Portal, {client_name}</h2>
    <p>Dear {client_name},</p>
    <p>
      We are delighted to inform you that your profile has been <strong>approved</strong>
      and you are now a registered client of Anchor Mill Group.
    </p>
    <p>
      Please find your <strong>Compliance Clearance Certificate</strong> attached to this
      email for your records.  This document confirms that your KYC and AML documentation
      has been verified and cleared.
    </p>
    <p>
      Your dedicated Relationship Manager will be in touch shortly to discuss your
      onboarding programme.
    </p>
    {
        "<p><a href='" + settings.FRONTEND_URL + "'>Access your portal dashboard</a></p>"
        if settings.FRONTEND_URL
        else ""
    }
    <p>Best regards,<br><strong>AMG Team</strong><br>Anchor Mill Group — Private Client Services</p>
  </body>
</html>
"""

    try:
        if profile.compliance_certificate_path:
            # Fetch PDF bytes from MinIO
            pdf_bytes = await _fetch_pdf_from_storage(profile.compliance_certificate_path)
            if pdf_bytes:
                subject = (
                    f"Welcome to AMG Portal — Compliance Clearance Certificate for {client_name}"
                )
                await send_email_with_attachment(
                    to=profile.primary_email,
                    subject=subject,
                    body_html=body_html,
                    attachment=pdf_bytes,
                    attachment_filename="AMG_Compliance_Clearance_Certificate.pdf",
                    attachment_content_type="application/pdf",
                )
                logger.info(
                    "Sent welcome email with certificate PDF to %s for profile %s",
                    profile.primary_email,
                    profile.id,
                )
                return

        # Fallback: plain welcome email without attachment
        await send_email(
            to=profile.primary_email,
            subject=f"Welcome to AMG Portal, {client_name}",
            body_html=body_html,
        )
        logger.info(
            "Sent plain welcome email (no certificate PDF) to %s for profile %s",
            profile.primary_email,
            profile.id,
        )
    except Exception:
        logger.exception(
            "Failed to send welcome email to %s for profile %s — "
            "continuing with remainder of approval workflow",
            profile.primary_email,
            profile.id,
        )


async def _fetch_pdf_from_storage(object_path: str) -> bytes | None:
    """Retrieve raw PDF bytes from MinIO.  Returns ``None`` on any error."""
    try:
        from app.services.storage import storage_service

        return await storage_service.download_file(object_path)
    except Exception:
        logger.exception("Failed to fetch PDF from storage path %s", object_path)
        return None
