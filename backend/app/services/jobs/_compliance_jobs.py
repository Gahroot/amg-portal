"""Compliance, KYC, document, and partner governance background jobs."""

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.middleware.audit import with_system_audit_context
from app.models.access_audit import AccessAudit
from app.models.client import Client
from app.models.enums import UserRole
from app.models.kyc_document import KYCDocument
from app.models.notification import Notification
from app.models.partner import PartnerProfile
from app.models.partner_rating import PartnerRating
from app.models.user import User
from app.schemas.notification import CreateNotificationRequest
from app.services.access_audit_service import access_audit_service
from app.services.archival_service import archive_program, get_archival_candidates
from app.services.capability_review_service import capability_review_service
from app.services.document_expiry_service import check_and_send_expiry_alerts
from app.services.document_request_service import mark_overdue_requests
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)


@with_system_audit_context
async def _check_partner_threshold_alerts_job() -> None:
    """Daily job: alert MDs about partners with avg overall score below 3.0."""
    logger.info("Running partner threshold alerts job")
    try:
        from sqlalchemy import func as _sa_func

        async with AsyncSessionLocal() as db:
            # Find partners with avg overall < 3.0
            result = await db.execute(
                select(
                    PartnerRating.partner_id,
                    _sa_func.avg(PartnerRating.overall_score).label("avg_overall"),
                )
                .group_by(PartnerRating.partner_id)
                .having(_sa_func.avg(PartnerRating.overall_score) < 3.0)
            )
            low_partners = result.all()

            if not low_partners:
                logger.info("No low-performing partners found")
                return

            # Get partner names
            partner_ids = [row.partner_id for row in low_partners]

            partners_result = await db.execute(
                select(PartnerProfile).where(PartnerProfile.id.in_(partner_ids))
            )
            partner_map = {p.id: p.firm_name for p in partners_result.scalars().all()}

            # Get managing directors
            md_result = await db.execute(
                select(User.id).where(
                    User.role == "managing_director",
                    User.status == "active",
                )
            )
            md_ids = md_result.scalars().all()

            for lp in low_partners:
                firm = partner_map.get(lp.partner_id, "Unknown")
                avg_score = round(float(lp.avg_overall), 2)
                for md_id in md_ids:
                    await notification_service.create_notification(
                        db,
                        CreateNotificationRequest(
                            user_id=md_id,
                            notification_type="system",
                            title=(f"Low partner performance: {firm}"),
                            body=(
                                f"Partner {firm} has an"
                                f" average overall score"
                                f" of {avg_score}/5.0,"
                                " which is below the"
                                " threshold of 3.0."
                            ),
                            priority="high",
                        ),
                    )

            logger.info(
                "Partner threshold alerts complete — %d low-performing partners, %d MDs notified",
                len(low_partners),
                len(md_ids),
            )
    except Exception:
        logger.exception("Error in partner threshold alerts job")


@with_system_audit_context
async def _check_capability_review_reminders_job() -> None:
    """Daily job: send reminders for upcoming capability reviews and escalate overdue ones."""
    logger.info("Running capability review reminders job")
    try:
        async with AsyncSessionLocal() as db:
            # Get reviews due in the next 30 days
            reviews_due_soon = await capability_review_service.get_reviews_due_soon(db, days=30)

            for review in reviews_due_soon:
                # Skip if reminder already sent
                if review.reminder_sent_at:
                    continue

                # Notify reviewer if assigned
                if review.reviewer_id:
                    partner_name = review.partner.firm_name if review.partner else "Unknown"
                    await notification_service.create_notification(
                        db,
                        CreateNotificationRequest(
                            user_id=review.reviewer_id,
                            notification_type="system",
                            title=f"Upcoming Capability Review: {partner_name}",
                            body=(
                                f"The annual capability review for {partner_name} "
                                f"is scheduled for {review.scheduled_date}. "
                                "Please complete the review before this date."
                            ),
                            priority="high",
                            action_url=f"/capability-reviews/{review.id}",
                            action_label="View Review",
                        ),
                    )

                # Mark reminder as sent
                await capability_review_service.mark_reminder_sent(db, review.id)

            # Get overdue reviews
            overdue_reviews = await capability_review_service.get_overdue_reviews(db)

            # Get managing directors for escalation
            md_result = await db.execute(
                select(User.id).where(
                    User.role == "managing_director",
                    User.status == "active",
                )
            )
            md_ids = md_result.scalars().all()

            for review in overdue_reviews:
                # Escalate to MDs
                partner_name = review.partner.firm_name if review.partner else "Unknown"
                for md_id in md_ids:
                    await notification_service.create_notification(
                        db,
                        CreateNotificationRequest(
                            user_id=md_id,
                            notification_type="system",
                            title=f"Overdue Capability Review: {partner_name}",
                            body=(
                                f"The annual capability review for {partner_name} "
                                f"(Year {review.review_year}) is overdue. "
                                f"It was scheduled for {review.scheduled_date}."
                            ),
                            priority="urgent",
                            action_url=f"/capability-reviews/{review.id}",
                            action_label="View Review",
                        ),
                    )

            logger.info(
                "Capability review reminders complete — %d reminders sent, %d overdue escalated",
                len(reviews_due_soon),
                len(overdue_reviews),
            )
    except Exception:
        logger.exception("Error in capability review reminders job")


@with_system_audit_context
async def _quarterly_audit_reminder_job() -> None:
    """Quarterly job: remind compliance team to conduct access audit."""
    logger.info("Running quarterly audit reminder job")
    try:
        async with AsyncSessionLocal() as db:
            now = datetime.now(UTC)
            current_quarter = (now.month - 1) // 3 + 1
            current_year = now.year

            # Check if audit exists for current quarter
            result = await db.execute(
                select(AccessAudit).where(
                    AccessAudit.quarter == current_quarter,
                    AccessAudit.year == current_year,
                )
            )
            existing_audit = result.scalar_one_or_none()

            # Count dormant accounts to include in notifications
            dormant_users = await access_audit_service.detect_dormant_accounts(db)
            dormant_count = len(dormant_users)
            dormant_suffix = (
                f" There are currently {dormant_count} dormant account(s) that require review."
                if dormant_count > 0
                else ""
            )

            # Get compliance users
            compliance_result = await db.execute(
                select(User.id).where(
                    User.role == "finance_compliance",
                    User.status == "active",
                )
            )
            compliance_ids = compliance_result.scalars().all()

            # Also notify managing directors
            md_result = await db.execute(
                select(User.id).where(
                    User.role == "managing_director",
                    User.status == "active",
                )
            )
            md_ids = md_result.scalars().all()

            all_recipients = list(set(list(compliance_ids) + list(md_ids)))

            if not existing_audit:
                # No audit exists - send reminder to create one
                for user_id in all_recipients:
                    await notification_service.create_notification(
                        db,
                        CreateNotificationRequest(
                            user_id=user_id,
                            notification_type="system",
                            title=(f"Q{current_quarter} {current_year} Access Audit Required"),
                            body=(
                                f"The Q{current_quarter} {current_year}"
                                " quarterly access audit has not been"
                                " started. Please initiate the audit to"
                                " ensure compliance with access review"
                                f" policies.{dormant_suffix}"
                            ),
                            priority="high",
                            action_url="/access-audits",
                            action_label="Start Audit",
                        ),
                    )
                logger.info(
                    "Quarterly audit reminder sent to %d users for Q%d %d "
                    "(%d dormant accounts detected)",
                    len(all_recipients),
                    current_quarter,
                    current_year,
                    dormant_count,
                )
            elif existing_audit.status == "draft":
                # Audit started but not completed
                for user_id in all_recipients:
                    await notification_service.create_notification(
                        db,
                        CreateNotificationRequest(
                            user_id=user_id,
                            notification_type="system",
                            title=(f"Q{current_quarter} {current_year} Access Audit Incomplete"),
                            body=(
                                f"The Q{current_quarter} {current_year}"
                                " quarterly access audit is still in"
                                " draft status. Please complete the"
                                " audit findings and finalize the"
                                f" report.{dormant_suffix}"
                            ),
                            priority="normal",
                            action_url=f"/access-audits/{existing_audit.id}",
                            action_label="Continue Audit",
                        ),
                    )
                logger.info(
                    "Audit completion reminder sent to %d users for Q%d %d "
                    "(%d dormant accounts detected)",
                    len(all_recipients),
                    current_quarter,
                    current_year,
                    dormant_count,
                )
            else:
                logger.info(
                    "Q%d %d audit already completed, no reminder needed",
                    current_quarter,
                    current_year,
                )
    except Exception:
        logger.exception("Error in quarterly audit reminder job")


@with_system_audit_context
async def _check_data_retention_job() -> None:
    """Daily job: notify compliance team of programs eligible for archival.

    If AUTO_ARCHIVE_PROGRAMS is enabled, automatically archives eligible
    programs up to ARCHIVE_BATCH_SIZE per run.  Otherwise, sends an
    in-portal notification so the compliance team can review and manually
    trigger archival via POST /api/v1/programs/{id}/archive.
    """
    logger.info("Running data retention / archival check job")
    try:
        async with AsyncSessionLocal() as db:
            candidate_list = await get_archival_candidates(db)

        if not candidate_list.candidates:
            logger.info("Data retention check: no programs eligible for archival")
            return

        logger.info(
            "Data retention check: %d program(s) eligible for archival",
            candidate_list.total,
        )

        if settings.AUTO_ARCHIVE_PROGRAMS:
            # Auto-archive each eligible program
            for candidate in candidate_list.candidates:
                try:
                    async with AsyncSessionLocal() as db:
                        await archive_program(db, candidate.program_id)
                    logger.info(
                        "Auto-archived program %s ('%s')",
                        candidate.program_id,
                        candidate.title,
                    )
                except Exception:
                    logger.exception(
                        "Error auto-archiving program %s",
                        candidate.program_id,
                    )
        else:
            # Notify compliance users and MDs to review
            async with AsyncSessionLocal() as db:
                compliance_result = await db.execute(
                    select(User.id).where(
                        User.role.in_(
                            [UserRole.finance_compliance.value, UserRole.managing_director.value]
                        ),
                        User.status == "active",
                    )
                )
                recipient_ids = compliance_result.scalars().all()

            program_titles = ", ".join(f"'{c.title}'" for c in candidate_list.candidates[:5])
            if candidate_list.total > 5:
                program_titles += f" and {candidate_list.total - 5} more"

            for user_id in recipient_ids:
                try:
                    async with AsyncSessionLocal() as db:
                        await notification_service.create_notification(
                            db,
                            CreateNotificationRequest(
                                user_id=user_id,
                                notification_type="system",
                                title=(
                                    f"Data Retention: {candidate_list.total} program(s) "
                                    "eligible for archival"
                                ),
                                body=(
                                    f"{candidate_list.total} closed program(s) have exceeded "
                                    f"the {settings.DATA_RETENTION_DAYS}-day retention period "
                                    f"and are ready to be archived: {program_titles}. "
                                    "Review and archive via the Archival Candidates page."
                                ),
                                priority="normal",
                                action_url="/programs/archival-candidates",
                                action_label="Review Candidates",
                            ),
                        )
                except Exception:
                    logger.exception(
                        "Error sending archival notification to user %s",
                        user_id,
                    )

            logger.info(
                "Data retention check: notified %d user(s) about %d eligible program(s)",
                len(recipient_ids),
                candidate_list.total,
            )
    except Exception:
        logger.exception("Error in data retention check job")


@with_system_audit_context
async def _check_kyc_expiry_job() -> None:  # noqa: PLR0915
    """Daily job: check KYC documents for expiry and notify relevant users.

    Per design doc Section 08: "Monthly compliance review: KYC expiry dates,
    document completeness, access anomaly reports."

    Creates alerts for:
    - Documents expiring within 30 days → "warning" alert
    - Documents expiring within 7 days → "urgent" alert
    - Already expired documents → "expired" alert

    Notifications go to the assigned RM and Finance & Compliance users.
    """
    logger.info("Running KYC expiry check job")
    try:
        today = datetime.now(UTC).date()
        warning_cutoff = today + timedelta(days=30)

        async with AsyncSessionLocal() as db:
            # Query verified KYC documents with expiry dates within 30 days or already expired
            result = await db.execute(
                select(KYCDocument)
                .options(
                    selectinload(KYCDocument.client).selectinload(Client.rm),
                )
                .where(
                    KYCDocument.expiry_date.isnot(None),
                    KYCDocument.expiry_date <= warning_cutoff,
                    KYCDocument.status == "verified",
                )
            )
            kyc_docs = result.scalars().all()

            if not kyc_docs:
                logger.info("KYC expiry check: no documents expiring within 30 days")
                return

            # Get Finance & Compliance users
            fc_result = await db.execute(
                select(User.id).where(
                    User.role == UserRole.finance_compliance.value,
                    User.status == "active",
                )
            )
            fc_user_ids = list(fc_result.scalars().all())

            warning_count = 0
            urgent_count = 0
            expired_count = 0
            notifications_sent = 0

            for kyc_doc in kyc_docs:
                try:
                    expiry_date = kyc_doc.expiry_date
                    if expiry_date is None:
                        continue

                    days_until_expiry = (expiry_date - today).days
                    client_name = kyc_doc.client.name if kyc_doc.client else "Unknown client"

                    # Determine alert category and priority
                    if days_until_expiry <= 0:
                        alert_category = "expired"
                        priority = "urgent"
                        expiry_label = "has expired"
                        expired_count += 1
                    elif days_until_expiry <= 7:
                        alert_category = "urgent"
                        priority = "urgent"
                        expiry_label = f"expires in {days_until_expiry} day(s)"
                        urgent_count += 1
                    else:
                        alert_category = "warning"
                        priority = "high"
                        expiry_label = f"expires in {days_until_expiry} day(s)"
                        warning_count += 1

                    # Check for existing notification to avoid duplicates
                    # Look for notification with same entity and category within last 7 days
                    existing_result = await db.execute(
                        select(Notification).where(
                            Notification.entity_type == "kyc_document",
                            Notification.entity_id == kyc_doc.id,
                            Notification.title.contains(client_name),
                            Notification.created_at >= datetime.now() - timedelta(days=7),
                        )
                    )
                    if existing_result.scalar_one_or_none() is not None:
                        logger.debug(
                            "Skipping duplicate KYC expiry notification for doc %s",
                            kyc_doc.id,
                        )
                        continue

                    # Build notification content
                    doc_type = kyc_doc.document_type.replace("_", " ").title()
                    title = f"KYC Document Expiry: {doc_type} ({client_name})"
                    body = (
                        f"The KYC document '{kyc_doc.document_type.replace('_', ' ').title()}' "
                        f"for client {client_name} {expiry_label} "
                        f"(expiry date: {expiry_date}). "
                        f"Please take appropriate action to ensure compliance."
                    )

                    # Collect recipient IDs: RM + Finance & Compliance users
                    recipient_ids: set[UUID] = set(fc_user_ids)
                    if kyc_doc.client and kyc_doc.client.rm_id:
                        recipient_ids.add(kyc_doc.client.rm_id)

                    doc_id: UUID = kyc_doc.id
                    for user_id in recipient_ids:
                        await notification_service.create_notification(
                            db,
                            CreateNotificationRequest(
                                user_id=user_id,
                                notification_type="kyc_expiry",
                                title=title,
                                body=body,
                                priority=priority,
                                entity_type="kyc_document",
                                entity_id=doc_id,
                                action_url=f"/kyc/verifications/{doc_id}?client={kyc_doc.client_id}",
                                action_label="View Document",
                            ),
                        )
                        notifications_sent += 1

                    logger.info(
                        "Created %s KYC expiry alert for doc %s (client: %s, expires: %s)",
                        alert_category,
                        kyc_doc.id,
                        client_name,
                        expiry_date,
                    )

                except Exception:
                    logger.exception(
                        "Error processing KYC expiry for document %s",
                        kyc_doc.id,
                    )

            logger.info(
                "KYC expiry check complete — %d warning, %d urgent, %d expired, "
                "%d notifications sent",
                warning_count,
                urgent_count,
                expired_count,
                notifications_sent,
            )
    except Exception:
        logger.exception("Error in KYC expiry check job")


@with_system_audit_context
async def _check_document_expiry_job() -> None:
    """Daily job: send expiry alerts for passports, visas, and certifications."""
    logger.info("Running document expiry alerts job")
    try:
        async with AsyncSessionLocal() as db:
            sent = await check_and_send_expiry_alerts(db)
        logger.info("Document expiry alerts job complete — %d notifications sent", sent)
    except Exception:
        logger.exception("Error in document expiry alerts job")


@with_system_audit_context
async def _mark_overdue_document_requests_job() -> None:
    """Daily job: mark document requests whose deadline has passed as overdue."""
    logger.info("Running overdue document requests job")
    try:
        async with AsyncSessionLocal() as db:
            count = await mark_overdue_requests(db)
            logger.info("Overdue document requests marked — %d updated", count)
    except Exception:
        logger.exception("Error marking overdue document requests")
