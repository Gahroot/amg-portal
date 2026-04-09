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
from app.models.conversation import Conversation
from app.models.decision_request import DecisionRequest
from app.models.deliverable import Deliverable
from app.models.milestone import Milestone
from app.models.partner import PartnerProfile
from app.models.partner_assignment import PartnerAssignment
from app.models.program import Program
from app.schemas.notification import CreateNotificationRequest
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

    # Create in-portal notification for each recipient.
    # create_notification handles the per-type preference gate (never/immediate/daily/weekly)
    # and will send an immediate email if the user's preference calls for it.
    for uid in recipient_user_ids:
        notif_request = CreateNotificationRequest(
            user_id=uid,
            notification_type=template_type,
            title=subject or template.name,
            body=body or "",
            entity_type="communication",
            entity_id=comm.id,
            priority="normal",
        )
        await notification_service.create_notification(db, notif_request)

    await db.commit()
    logger.info(
        "Dispatched '%s' to %d recipient(s)",
        template_type,
        len(recipient_user_ids),
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


async def on_program_activated(
    db: AsyncSession,
    program: Program,
) -> None:
    """Send program_kickoff notification when a program transitions to active."""
    result = await db.execute(select(Client).where(Client.id == program.client_id))
    client = result.scalar_one_or_none()
    if not client:
        logger.warning(
            "Client not found for program %s — skipping activation notification",
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


async def _ensure_assignment_conversation(
    db: AsyncSession,
    assignment: PartnerAssignment,
    partner: PartnerProfile,
) -> None:
    """Create a coordinator_partner conversation for the assignment if none exists."""
    existing = await db.execute(
        select(Conversation).where(
            Conversation.partner_assignment_id == assignment.id,
        )
    )
    if existing.scalar_one_or_none():
        return

    # Participants: the partner's portal user + the coordinator who assigned
    participant_ids: list[uuid.UUID] = []
    if partner.user_id:
        participant_ids.append(uuid.UUID(str(partner.user_id)))
    assigned_by_id = uuid.UUID(str(assignment.assigned_by))
    if assigned_by_id not in participant_ids:
        participant_ids.append(assigned_by_id)

    conversation = Conversation(
        conversation_type="coordinator_partner",
        partner_assignment_id=uuid.UUID(str(assignment.id)),
        title=str(assignment.title),
        participant_ids=participant_ids,
        last_activity_at=datetime.now(UTC),
    )
    db.add(conversation)
    await db.flush()
    logger.info(
        "Created coordinator_partner conversation for assignment %s",
        assignment.id,
    )


async def on_assignment_dispatched(
    db: AsyncSession,
    assignment: PartnerAssignment,
) -> None:
    """Send partner_dispatch to the partner user and open a coordinator conversation."""
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

    # Open a coordinator_partner conversation for this assignment (idempotent)
    await _ensure_assignment_conversation(db, assignment, partner)

    # Get program title (scoped — no client name, no financials)
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
            # brief is coordinator-authored and must not contain client name,
            # financial data, other partner names, or budget information
            "brief": str(assignment.brief or ""),
            "due_date": due_date,
        },
        program_id=uuid.UUID(str(assignment.program_id)),
        partner_id=uuid.UUID(str(partner.id)),
    )


async def on_assignment_accepted(
    db: AsyncSession,
    assignment: PartnerAssignment,
) -> None:
    """Notify the coordinator when a partner accepts an assignment (SLA clock starts)."""
    result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id == assignment.partner_id)
    )
    partner = result.scalar_one_or_none()
    partner_firm_name = partner.firm_name if partner else "Unknown"

    accepted_at = (
        assignment.accepted_at.strftime("%Y-%m-%d %H:%M UTC")
        if assignment.accepted_at
        else "now"
    )

    await dispatch_template_message(
        db,
        template_type="assignment_accepted",
        recipient_user_ids=[uuid.UUID(str(assignment.assigned_by))],
        variables={
            "assignment_title": str(assignment.title),
            "partner_firm_name": str(partner_firm_name),
            "accepted_at": accepted_at,
        },
        program_id=uuid.UUID(str(assignment.program_id)),
        partner_id=uuid.UUID(str(assignment.partner_id)),
    )


async def on_assignment_declined(
    db: AsyncSession,
    assignment: PartnerAssignment,
) -> None:
    """Notify the coordinator and RM when a partner declines an assignment."""
    result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id == assignment.partner_id)
    )
    partner = result.scalar_one_or_none()
    partner_firm_name = partner.firm_name if partner else "Unknown"

    # Coordinator is always notified
    recipients: list[uuid.UUID] = [uuid.UUID(str(assignment.assigned_by))]

    # Also notify the RM via program → client → rm_id (if different from coordinator)
    prog_result = await db.execute(select(Program).where(Program.id == assignment.program_id))
    program = prog_result.scalar_one_or_none()
    if program:
        client_result = await db.execute(select(Client).where(Client.id == program.client_id))
        client = client_result.scalar_one_or_none()
        if client:
            rm_id = uuid.UUID(str(client.rm_id))
            if rm_id not in recipients:
                recipients.append(rm_id)

    await dispatch_template_message(
        db,
        template_type="assignment_declined",
        recipient_user_ids=recipients,
        variables={
            "assignment_title": str(assignment.title),
            "partner_firm_name": str(partner_firm_name),
        },
        program_id=uuid.UUID(str(assignment.program_id)),
        partner_id=uuid.UUID(str(assignment.partner_id)),
    )


async def on_deliverable_submitted(
    db: AsyncSession,
    deliverable: Deliverable,
) -> None:
    """Send deliverable_submission to the coordinator and start SLA clock."""
    from app.models.enums import CommunicationType
    from app.services.sla_service import start_sla_clock

    # Get assignment to find assigned_by (coordinator)
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

    # Start 4-hour SLA clock for coordinator review
    try:
        await start_sla_clock(
            db,
            entity_type="deliverable",
            entity_id=str(deliverable.id),
            communication_type=CommunicationType.partner_submission,
            assigned_to=uuid.UUID(str(assignment.assigned_by)),
            sla_hours=4,
        )
    except Exception:
        logger.exception(
            "Failed to start SLA clock for deliverable %s",
            deliverable.id,
        )


async def _get_partner_user_id(
    db: AsyncSession,
    assignment: PartnerAssignment,
) -> uuid.UUID | None:
    """Return the portal user_id for the partner on this assignment."""
    partner_result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id == assignment.partner_id)
    )
    partner = partner_result.scalar_one_or_none()
    if not partner or not partner.user_id:
        return None
    return uuid.UUID(str(partner.user_id))


async def _get_client_user_id_for_assignment(
    db: AsyncSession,
    assignment: PartnerAssignment,
) -> uuid.UUID | None:
    """Return the portal user_id for the client associated with this assignment's program."""
    from app.models.client_profile import ClientProfile

    prog_result = await db.execute(select(Program).where(Program.id == assignment.program_id))
    program = prog_result.scalar_one_or_none()
    if not program:
        return None

    client_result = await db.execute(select(Client).where(Client.id == program.client_id))
    client = client_result.scalar_one_or_none()
    if not client:
        return None

    # Match ClientProfile by rm_id and legal_name (same logic as client portal)
    profile_query = select(ClientProfile).where(ClientProfile.assigned_rm_id == client.rm_id)
    profile_result = await db.execute(profile_query.limit(1))
    profile = profile_result.scalar_one_or_none()
    if not profile or not profile.user_id:
        return None
    return uuid.UUID(str(profile.user_id))


async def on_deliverable_reviewed(
    db: AsyncSession,
    deliverable: Deliverable,
    new_status: str,
) -> None:
    """Notify the partner (and client on approval) after a coordinator review decision."""
    # Get assignment
    result = await db.execute(
        select(PartnerAssignment).where(PartnerAssignment.id == deliverable.assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        return

    partner_user_id = await _get_partner_user_id(db, assignment)

    deliverable_id = uuid.UUID(str(deliverable.id))

    if new_status == "approved":
        # Notify partner
        if partner_user_id:
            notif_request = CreateNotificationRequest(
                user_id=partner_user_id,
                notification_type="deliverable_ready",
                title="Deliverable Approved",
                body=f'Your deliverable "{deliverable.title}" has been approved.',
                entity_type="deliverable",
                entity_id=deliverable_id,
                priority="normal",
            )
            await notification_service.create_notification(db, notif_request)

        # Notify client
        client_user_id = await _get_client_user_id_for_assignment(db, assignment)
        if client_user_id:
            notif_request = CreateNotificationRequest(
                user_id=client_user_id,
                notification_type="deliverable_ready",
                title="New Deliverable Available",
                body=f'A new deliverable is available: "{deliverable.title}".',
                entity_type="deliverable",
                entity_id=deliverable_id,
                priority="normal",
            )
            await notification_service.create_notification(db, notif_request)

    elif new_status == "returned":
        # Notify partner with review comments
        if partner_user_id:
            comments = deliverable.review_comments or "Please see comments from your coordinator."
            notif_request = CreateNotificationRequest(
                user_id=partner_user_id,
                notification_type="assignment_update",
                title="Deliverable Returned for Revisions",
                body=(
                    f'Your deliverable "{deliverable.title}" requires revisions. '
                    f"Comments: {comments}"
                ),
                entity_type="deliverable",
                entity_id=deliverable_id,
                priority="normal",
            )
            await notification_service.create_notification(db, notif_request)

    elif new_status == "rejected":
        # Notify partner with rejection reason
        if partner_user_id:
            reason = deliverable.review_comments or "No reason provided."
            notif_request = CreateNotificationRequest(
                user_id=partner_user_id,
                notification_type="assignment_update",
                title="Deliverable Rejected",
                body=(
                    f'Your deliverable "{deliverable.title}" has been rejected. '
                    f"Reason: {reason}"
                ),
                entity_type="deliverable",
                entity_id=deliverable_id,
                priority="high",
            )
            await notification_service.create_notification(db, notif_request)


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


async def _ensure_client_rm_conversation(
    db: AsyncSession,
    client_profile: ClientProfile,
    client_user_id: uuid.UUID,
    rm_user_id: uuid.UUID,
) -> Conversation:
    """Create an rm_client conversation for the client-RM pair if none exists.

    This ensures the welcome message appears in the client's Messages page.
    """
    existing = await db.execute(
        select(Conversation).where(
            Conversation.client_id == client_profile.id,
            Conversation.conversation_type == "rm_client",
        )
    )
    conv = existing.scalar_one_or_none()
    if conv:
        return conv

    participant_ids = [client_user_id, rm_user_id]
    # De-duplicate in case client and RM are same user (shouldn't happen)
    participant_ids = list(set(participant_ids))

    conv = Conversation(
        conversation_type="rm_client",
        client_id=client_profile.id,
        title=f"Conversation with {client_profile.display_name or client_profile.legal_name}",
        participant_ids=participant_ids,
        last_activity_at=datetime.now(UTC),
    )
    db.add(conv)
    await db.flush()
    logger.info(
        "Created rm_client conversation for client %s",
        client_profile.id,
    )
    return conv


async def on_client_provisioned(
    db: AsyncSession,
    client_profile: ClientProfile,
    client_user_id: uuid.UUID,
    portal_url: str,
) -> None:
    """Dispatch welcome message when a client profile is provisioned.

    This hook is called after client provisioning creates a portal user account.
    It dispatches a templated welcome message personalized with RM details
    and ensures a client-RM conversation exists for the Messages page.

    Trigger chain:
    1. RM creates client profile → intake workflow
    2. Compliance reviews → MD approves
    3. Admin provisions client (creates portal user) → provision_client_user()
    4. This hook fires → welcome message dispatched + conversation created
    """
    if not client_profile.assigned_rm_id:
        logger.warning(
            "Client %s has no assigned RM, skipping welcome dispatch",
            client_profile.id,
        )
        return

    # Fetch RM user info for personalization
    from app.models.user import User

    rm_result = await db.execute(select(User).where(User.id == client_profile.assigned_rm_id))
    rm_user = rm_result.scalar_one_or_none()
    if not rm_user:
        logger.warning(
            "RM user %s not found for client %s, skipping welcome dispatch",
            client_profile.assigned_rm_id,
            client_profile.id,
        )
        return

    client_name = client_profile.display_name or client_profile.legal_name

    # Ensure client-RM conversation exists for Messages page
    await _ensure_client_rm_conversation(
        db, client_profile, client_user_id, rm_user.id
    )

    # Dispatch welcome template message
    await dispatch_template_message(
        db,
        template_type="welcome",
        recipient_user_ids=[client_user_id],
        variables={
            "client_name": client_name,
            "rm_name": rm_user.full_name,
            "rm_email": rm_user.email,
            "portal_url": portal_url,
        },
        client_id=client_profile.id,
    )
    logger.info(
        "Welcome message dispatched to client %s (user %s)",
        client_profile.id,
        client_user_id,
    )
