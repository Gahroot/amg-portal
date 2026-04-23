"""Auto-dispatch service for template-based notifications."""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client_profile import ClientProfile
from app.models.conversation import Conversation
from app.models.decision_request import DecisionRequest
from app.models.milestone import Milestone
from app.models.program import Program
from app.services.auto_dispatch_assignments import (
    on_assignment_accepted,
    on_assignment_declined,
    on_assignment_dispatched,
    on_deliverable_reviewed,
    on_deliverable_submitted,
)
from app.services.auto_dispatch_programs import (
    dispatch_template_message,
    on_program_activated,
    on_program_completed,
    on_program_created,
)

__all__ = [
    "dispatch_template_message",
    "on_program_created",
    "on_program_activated",
    "on_program_completed",
    "on_assignment_dispatched",
    "on_assignment_accepted",
    "on_assignment_declined",
    "on_deliverable_submitted",
    "on_deliverable_reviewed",
    "on_decision_requested",
    "on_milestone_alert",
    "on_client_provisioned",
]

logger = logging.getLogger(__name__)


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
    await _ensure_client_rm_conversation(db, client_profile, client_user_id, rm_user.id)

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
