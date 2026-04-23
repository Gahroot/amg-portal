"""Auto-dispatch: assignment and deliverable lifecycle hooks."""

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.client_profile import ClientProfile
from app.models.conversation import Conversation
from app.models.deliverable import Deliverable
from app.models.partner import PartnerProfile
from app.models.partner_assignment import PartnerAssignment
from app.models.program import Program
from app.schemas.notification import CreateNotificationRequest
from app.services.auto_dispatch_programs import dispatch_template_message
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)


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
        assignment.accepted_at.strftime("%Y-%m-%d %H:%M UTC") if assignment.accepted_at else "now"
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
                    f'Your deliverable "{deliverable.title}" has been rejected. Reason: {reason}'
                ),
                entity_type="deliverable",
                entity_id=deliverable_id,
                priority="high",
            )
            await notification_service.create_notification(db, notif_request)
