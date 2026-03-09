"""Auto-dispatch service for template-based notifications."""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.client_profile import ClientProfile
from app.models.communication import Communication
from app.models.communication_template import CommunicationTemplate
from app.models.decision_request import DecisionRequest
from app.models.deliverable import Deliverable
from app.models.milestone import Milestone
from app.models.notification_preference import NotificationPreference
from app.models.partner import PartnerProfile
from app.models.partner_assignment import PartnerAssignment
from app.models.program import Program
from app.models.user import User
from app.schemas.notification import CreateNotificationRequest
from app.services.email_service import send_email
from app.services.notification_service import notification_service
from app.services.template_service import template_service

logger = logging.getLogger(__name__)


async def dispatch_template_message(
    db: AsyncSession,
    template_type: str,
    recipient_user_ids: list[uuid.UUID],
    variables: dict[str, Any],
    program_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
    partner_id: uuid.UUID | None = None,
) -> None:
    """Dispatch a template-based message to recipients.

    Looks up the template, renders it, creates a
    Communication record, and notifies each recipient.
    """
    if not recipient_user_ids:
        logger.warning(
            "No recipients for template '%s', skipping",
            template_type,
        )
        return

    # Find active template by type
    result = await db.execute(
        select(CommunicationTemplate)
        .where(
            CommunicationTemplate.template_type == template_type,
            CommunicationTemplate.is_active.is_(True),
        )
        .order_by(
            # Prefer system templates
            CommunicationTemplate.is_system.desc()
        )
        .limit(1)
    )
    template = result.scalar_one_or_none()
    if not template:
        logger.error(
            "No active template found for type '%s'",
            template_type,
        )
        return

    # Render the template
    rendered = await template_service.render_template(db, template.id, variables)
    if not rendered:
        logger.error(
            "Failed to render template '%s'",
            template_type,
        )
        return

    subject = rendered.get("subject", "")
    body = rendered.get("body", "")

    # Build recipients JSON
    recipients_json = {str(uid): {"role": "to"} for uid in recipient_user_ids}

    # Create Communication record
    comm = Communication(
        channel="in_portal",
        status="sent",
        recipients=recipients_json,
        subject=subject,
        body=body,
        client_id=client_id,
        program_id=program_id,
        partner_id=partner_id,
        sent_at=datetime.now(UTC),
    )
    db.add(comm)
    await db.flush()

    # Create notification for each recipient
    for uid in recipient_user_ids:
        notif_request = CreateNotificationRequest(
            user_id=uid,
            notification_type=template_type,
            title=subject or template.name,
            body=body,
            entity_type="communication",
            entity_id=comm.id,
            priority="normal",
        )
        await notification_service.create_notification(db, notif_request)

        # Check if user wants immediate email
        pref_result = await db.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == uid)
        )
        pref = pref_result.scalar_one_or_none()
        if pref and pref.notification_type_preferences:
            type_pref = pref.notification_type_preferences.get(template_type, "")
            if type_pref == "immediate":
                await _send_immediate_email(db, uid, subject or "", body)

    await db.commit()
    logger.info(
        "Dispatched '%s' to %d recipient(s)",
        template_type,
        len(recipient_user_ids),
    )


async def _send_immediate_email(
    db: AsyncSession,
    user_id: uuid.UUID,
    subject: str,
    body: str,
) -> None:
    """Send immediate email notification to a user."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return

    try:
        body_html = f"<html><body><pre>{body}</pre></body></html>"
        await send_email(
            to=user.email,
            subject=subject,
            body_html=body_html,
            body_text=body,
        )
    except Exception:
        logger.exception(
            "Failed to send immediate email to user %s",
            user_id,
        )


# ---- Convenience hook functions ----


async def on_program_created(
    db: AsyncSession,
    program: Program,
) -> None:
    """Send program_kickoff notification when created."""
    # Look up client to get RM
    result = await db.execute(select(Client).where(Client.id == program.client_id))
    client = result.scalar_one_or_none()
    if not client:
        logger.warning(
            "Client not found for program %s",
            program.id,
        )
        return

    start_date = str(program.start_date) if program.start_date else "TBD"

    await dispatch_template_message(
        db,
        template_type="program_kickoff",
        recipient_user_ids=[client.rm_id],
        variables={
            "program_title": program.title,
            "client_name": client.name,
            "start_date": start_date,
        },
        program_id=program.id,
        client_id=program.client_id,
    )


async def on_program_completed(
    db: AsyncSession,
    program: Program,
) -> None:
    """Send completion_note when program is completed."""
    result = await db.execute(select(Client).where(Client.id == program.client_id))
    client = result.scalar_one_or_none()
    if not client:
        return

    recipients = [program.created_by, client.rm_id]
    # De-duplicate
    unique_recipients = list(set(recipients))

    await dispatch_template_message(
        db,
        template_type="completion_note",
        recipient_user_ids=unique_recipients,
        variables={
            "program_title": program.title,
            "client_name": client.name,
        },
        program_id=program.id,
        client_id=program.client_id,
    )


async def on_assignment_dispatched(
    db: AsyncSession,
    assignment: PartnerAssignment,
) -> None:
    """Send partner_dispatch to the partner user."""
    result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id == assignment.partner_id)
    )
    partner = result.scalar_one_or_none()
    if not partner or not partner.user_id:
        logger.warning(
            "Partner or partner user not found for assignment %s",
            assignment.id,
        )
        return

    # Get program title
    prog_result = await db.execute(select(Program).where(Program.id == assignment.program_id))
    program = prog_result.scalar_one_or_none()
    program_title = program.title if program else "Unknown"

    due_date = str(assignment.due_date) if assignment.due_date else "TBD"

    await dispatch_template_message(
        db,
        template_type="partner_dispatch",
        recipient_user_ids=[uuid.UUID(str(partner.user_id))],
        variables={
            "assignment_title": str(assignment.title),
            "program_title": program_title,
            "brief": str(assignment.brief or ""),
            "due_date": due_date,
        },
        program_id=uuid.UUID(str(assignment.program_id)),
        partner_id=uuid.UUID(str(partner.id)),
    )


async def on_deliverable_submitted(
    db: AsyncSession,
    deliverable: Deliverable,
) -> None:
    """Send deliverable_submission to the RM."""
    # Get assignment to find assigned_by
    result = await db.execute(
        select(PartnerAssignment).where(PartnerAssignment.id == deliverable.assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        return

    # Get partner name
    partner_result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id == assignment.partner_id)
    )
    partner = partner_result.scalar_one_or_none()
    partner_name = partner.contact_name if partner else "Unknown"

    # Get program title
    prog_result = await db.execute(select(Program).where(Program.id == assignment.program_id))
    program = prog_result.scalar_one_or_none()
    program_title = program.title if program else "Unknown"

    await dispatch_template_message(
        db,
        template_type="deliverable_submission",
        recipient_user_ids=[uuid.UUID(str(assignment.assigned_by))],
        variables={
            "deliverable_title": str(deliverable.title),
            "partner_name": str(partner_name),
            "program_title": program_title,
        },
        program_id=uuid.UUID(str(assignment.program_id)),
        partner_id=uuid.UUID(str(assignment.partner_id)),
    )


async def on_decision_requested(
    db: AsyncSession,
    decision: DecisionRequest,
) -> None:
    """Send decision_request to the client user."""
    # DecisionRequest.client_id references client_profiles
    result = await db.execute(select(ClientProfile).where(ClientProfile.id == decision.client_id))
    client_profile = result.scalar_one_or_none()
    if not client_profile or not client_profile.user_id:
        logger.warning(
            "Client profile or user not found for decision %s",
            decision.id,
        )
        return

    deadline_str = str(decision.deadline_date) if decision.deadline_date else "No deadline"

    await dispatch_template_message(
        db,
        template_type="decision_request",
        recipient_user_ids=[client_profile.user_id],
        variables={
            "decision_title": decision.title,
            "description": decision.prompt,
            "deadline": deadline_str,
            "portal_url": "/decisions/" + str(decision.id),
        },
        program_id=decision.program_id,
        client_id=decision.client_id,
    )


async def on_milestone_alert(
    db: AsyncSession,
    milestone: Milestone,
    risk_factors: dict[str, Any],
) -> None:
    """Send milestone_alert to the program creator."""
    result = await db.execute(select(Program).where(Program.id == milestone.program_id))
    program = result.scalar_one_or_none()
    if not program:
        return

    due_date = str(milestone.due_date) if milestone.due_date else "TBD"

    risk_text = "\n".join(f"- {k}: {v}" for k, v in risk_factors.items())

    await dispatch_template_message(
        db,
        template_type="milestone_alert",
        recipient_user_ids=[program.created_by],
        variables={
            "milestone_title": milestone.title,
            "program_title": program.title,
            "risk_factors": risk_text,
            "due_date": due_date,
        },
        program_id=program.id,
    )
