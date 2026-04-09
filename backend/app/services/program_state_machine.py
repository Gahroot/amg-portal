"""Program state machine — validates and executes status transitions."""

import logging
import uuid
from collections.abc import Callable, Coroutine
from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationException
from app.models.audit_log import AuditLog
from app.models.enums import ProgramStatus
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.program_closure import ProgramClosure

if TYPE_CHECKING:
    from app.models.user import User

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Allowed transitions
# ---------------------------------------------------------------------------

VALID_TRANSITIONS: dict[str, list[str]] = {
    "intake": ["design", "closed"],
    "design": ["active", "intake", "closed"],
    "active": ["on_hold", "completed", "closed"],
    "on_hold": ["active", "closed"],
    "completed": ["closed", "archived"],
    "closed": ["archived"],
    "archived": [],
}


def validate_transition(current_status: str, new_status: str) -> bool:
    """Return True when moving from *current_status* to *new_status* is allowed."""
    return new_status in VALID_TRANSITIONS.get(current_status, [])


# ---------------------------------------------------------------------------
# Pre-transition guards
# ---------------------------------------------------------------------------


async def _guard_active(db: AsyncSession, program: Program) -> None:
    """Require at least one milestone and no pending budget approvals before activating."""
    result = await db.execute(
        select(Milestone).where(Milestone.program_id == program.id).limit(1)
    )
    if result.scalar_one_or_none() is None:
        raise ValidationException(
            "Cannot activate program: it must have at least one milestone."
        )

    from app.services.program_budget_service import has_pending_budget_approval

    if await has_pending_budget_approval(db, program.id):
        raise ValidationException(
            "Cannot activate program: a budget approval is pending. "
            "The program can only be activated once all budget approvals are complete."
        )


async def _guard_completed(db: AsyncSession, program: Program) -> None:
    """Require all milestones to be completed before marking the program completed."""
    result = await db.execute(
        select(Milestone).where(
            Milestone.program_id == program.id,
            Milestone.status != "completed",
        )
    )
    incomplete = list(result.scalars().all())
    if incomplete:
        titles = [m.title for m in incomplete]
        raise ValidationException(
            f"Cannot complete program: {len(incomplete)} milestone(s) are not yet "
            f"completed: {', '.join(titles)}."
        )


async def _guard_closed(db: AsyncSession, program: Program) -> None:
    """Require a completed closure checklist before closing the program."""
    result = await db.execute(
        select(ProgramClosure).where(ProgramClosure.program_id == program.id)
    )
    closure = result.scalar_one_or_none()
    if not closure:
        raise ValidationException(
            "Cannot close program: no closure checklist found. "
            "Initiate the closure workflow first."
        )
    incomplete_items = [
        item for item in (closure.checklist or []) if not item.get("completed", False)
    ]
    if incomplete_items:
        labels = [str(item["label"]) for item in incomplete_items]
        raise ValidationException(
            f"Cannot close program: closure checklist has incomplete items: "
            f"{', '.join(labels)}."
        )


_GUARDS = {
    "active": _guard_active,
    "completed": _guard_completed,
    "closed": _guard_closed,
}


# ---------------------------------------------------------------------------
# Post-transition side effects
# ---------------------------------------------------------------------------


async def _effect_design_to_active(db: AsyncSession, program: Program) -> None:
    """Dispatch kickoff/welcome notification to the client's RM on program activation."""
    try:
        from app.services.auto_dispatch_service import on_program_activated

        await on_program_activated(db, program)
    except Exception:
        logger.exception(
            "Failed to dispatch activation notification for program %s",
            program.id,
        )


async def _effect_active_to_completed(db: AsyncSession, program: Program) -> None:
    """Trigger the closure workflow when a program is marked completed."""
    try:
        from app.services.auto_dispatch_service import on_program_completed

        await on_program_completed(db, program)
    except Exception:
        logger.exception(
            "Failed to dispatch completion notification for program %s",
            program.id,
        )


async def _effect_completed_to_closed(db: AsyncSession, program: Program) -> None:
    """Archive the program when it moves from completed to closed."""
    logger.info(
        "Program %s ('%s') moved to closed — archival workflow triggered.",
        program.id,
        program.title,
    )
    # Future extension point: freeze billing, generate archived snapshots, etc.


_EffectFn = Callable[[AsyncSession, Program], Coroutine[Any, Any, None]]

_SIDE_EFFECTS: dict[tuple[str, str], _EffectFn] = {
    ("design", "active"): _effect_design_to_active,
    ("active", "completed"): _effect_active_to_completed,
    ("completed", "closed"): _effect_completed_to_closed,
}


# ---------------------------------------------------------------------------
# Real-time broadcast helper
# ---------------------------------------------------------------------------


async def _broadcast_program_update(
    db: AsyncSession,
    program: Program,
    from_status: str,
    to_status: str,
) -> None:
    """Broadcast a program status change to the client, assigned partners, and creator."""
    from app.api.ws_connection import connection_manager
    from app.models.client import Client
    from app.models.client_profile import ClientProfile
    from app.models.partner import PartnerProfile
    from app.models.partner_assignment import PartnerAssignment

    payload: dict[str, object] = {
        "type": "program_update",
        "data": {
            "id": str(program.id),
            "title": program.title,
            "status": to_status,
            "previous_status": from_status,
        },
    }

    recipients: set[uuid.UUID] = set()

    # Program creator
    if program.created_by:
        recipients.add(uuid.UUID(str(program.created_by)))

    # Client portal user (via ClientProfile.user_id)
    if program.client_id:
        client_result = await db.execute(
            select(Client).where(Client.id == program.client_id)
        )
        client = client_result.scalar_one_or_none()
        if client:
            profile_result = await db.execute(
                select(ClientProfile)
                .where(
                    ClientProfile.assigned_rm_id == client.rm_id,
                    ClientProfile.legal_name == client.name,
                )
                .limit(1)
            )
            profile = profile_result.scalar_one_or_none()
            if profile and profile.user_id:
                recipients.add(uuid.UUID(str(profile.user_id)))

    # Assigned partner portal users
    assignment_result = await db.execute(
        select(PartnerAssignment).where(PartnerAssignment.program_id == program.id)
    )
    assignments = list(assignment_result.scalars().all())
    for assignment in assignments:
        partner_result = await db.execute(
            select(PartnerProfile).where(PartnerProfile.id == assignment.partner_id)
        )
        partner = partner_result.scalar_one_or_none()
        if partner and partner.user_id:
            recipients.add(uuid.UUID(str(partner.user_id)))

    for user_id in recipients:
        await connection_manager.send_personal(payload, user_id)


# ---------------------------------------------------------------------------
# Audit helpers
# ---------------------------------------------------------------------------


async def _write_audit_log(
    db: AsyncSession,
    program: Program,
    from_status: str,
    to_status: str,
    user: "User",
) -> None:
    log = AuditLog(
        user_id=uuid.UUID(str(user.id)),
        user_email=user.email,
        action="update",
        entity_type="program",
        entity_id=str(program.id),
        before_state={"status": from_status},
        after_state={"status": to_status},
    )
    db.add(log)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def transition_program(
    db: AsyncSession,
    program: Program,
    new_status: str,
    user: "User",
) -> Program:
    """Validate and execute a program status transition.

    Raises HTTP 422 for invalid transitions or failed pre-condition checks.
    Side effects (notifications, archival) are fired after the DB flush so
    the status change is already visible within the transaction.
    """
    current_status = str(program.status)

    if current_status == new_status:
        return program

    if not validate_transition(current_status, new_status):
        allowed = VALID_TRANSITIONS.get(current_status, [])
        raise ValidationException(
            f"Invalid status transition: '{current_status}' → '{new_status}'. "
            f"Allowed next states: {allowed if allowed else ['none']}."
        )

    # Run pre-condition guard (if any) for the target status
    guard = _GUARDS.get(new_status)
    if guard is not None:
        await guard(db, program)

    # Apply the transition
    program.status = ProgramStatus(new_status)
    await _write_audit_log(db, program, current_status, new_status, user)
    await db.flush()

    logger.info(
        "Program %s transitioned: '%s' → '%s' by user %s",
        program.id,
        current_status,
        new_status,
        user.id,
    )

    # Fire side effects (failures are swallowed so the transition still commits)
    effect = _SIDE_EFFECTS.get((current_status, new_status))
    if effect is not None:
        await effect(db, program)

    # Broadcast real-time update to client, partners, and creator
    try:
        await _broadcast_program_update(db, program, current_status, new_status)
    except Exception:
        logger.exception("Failed to broadcast program update for program %s", program.id)

    return program
