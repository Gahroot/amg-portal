"""Program lifecycle status transition validator.

Enforces the allowed status flow:
    intake → design → active → on_hold → active (resume)
                    → active → completed → closed → archived

Each transition may have preconditions (approvals, milestone completion, etc.).
"""

from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.approval import ProgramApproval
from app.models.budget_approval import ApprovalThreshold
from app.models.enums import (
    MilestoneStatus,
    ProgramApprovalStatus,
    ProgramStatus,
    UserRole,
)
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.program_closure import ProgramClosure
from app.models.user import User

# Adjacency map: current_status → set of valid next statuses
ALLOWED_TRANSITIONS: dict[ProgramStatus, set[ProgramStatus]] = {
    ProgramStatus.intake: {ProgramStatus.design},
    ProgramStatus.design: {ProgramStatus.active},
    ProgramStatus.active: {ProgramStatus.on_hold, ProgramStatus.completed},
    ProgramStatus.on_hold: {ProgramStatus.active},
    ProgramStatus.completed: {ProgramStatus.closed},
    ProgramStatus.closed: {ProgramStatus.archived},
    ProgramStatus.archived: set(),
}


class InvalidTransitionError(HTTPException):
    """Raised when a status transition is not allowed."""

    def __init__(self, detail: str) -> None:
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
        )


def _resolve_status(value: str) -> ProgramStatus:
    """Convert a raw string to ProgramStatus, raising 422 on unknown values."""
    try:
        return ProgramStatus(value)
    except ValueError as exc:
        raise InvalidTransitionError(f"Unknown program status: '{value}'") from exc


async def _check_design_to_active(
    db: AsyncSession,
    program: Program,
) -> None:
    """design → active requires an approved ProgramApproval.

    If the program budget exceeds the lowest active approval threshold,
    the approval must have been granted by a Managing Director.
    Otherwise RM sign-off is sufficient.
    """
    # Fetch the most recent approved ProgramApproval for this program
    result = await db.execute(
        select(ProgramApproval)
        .where(
            ProgramApproval.program_id == program.id,
            ProgramApproval.status == ProgramApprovalStatus.approved,
        )
        .order_by(ProgramApproval.created_at.desc())
        .limit(1)
    )
    approval = result.scalar_one_or_none()

    if approval is None:
        raise InvalidTransitionError(
            "Cannot activate program: an approved ProgramApproval is required "
            "before transitioning from 'design' to 'active'."
        )

    # Determine whether the budget triggers elevated approval
    budget = Decimal(program.budget_envelope) if program.budget_envelope is not None else Decimal(0)

    # Find the lowest active threshold to decide if MD sign-off is needed
    threshold_result = await db.execute(
        select(ApprovalThreshold)
        .where(ApprovalThreshold.is_active.is_(True))
        .order_by(ApprovalThreshold.min_amount.asc())
        .limit(1)
    )
    threshold = threshold_result.scalar_one_or_none()

    if threshold is not None and budget >= threshold.min_amount:
        # Elevated: need MD approval — check the approver's role
        if approval.approved_by is None:
            raise InvalidTransitionError(
                "Cannot activate program: elevated budget requires Managing Director approval, "
                "but the approval has no recorded approver."
            )
        approver_result = await db.execute(
            select(User.role).where(User.id == approval.approved_by)
        )
        approver_role = approver_result.scalar_one_or_none()
        if approver_role != UserRole.managing_director:
            raise InvalidTransitionError(
                "Cannot activate program: budget exceeds approval threshold — "
                "Managing Director approval is required in addition to RM sign-off."
            )


async def _check_active_to_completed(
    db: AsyncSession,
    program: Program,
) -> None:
    """active → completed requires all milestones to be completed or cancelled."""
    result = await db.execute(
        select(Milestone).where(Milestone.program_id == program.id)
    )
    milestones = list(result.scalars().all())

    if not milestones:
        # No milestones is acceptable — nothing to block
        return

    terminal_statuses = {MilestoneStatus.completed, MilestoneStatus.cancelled}
    open_milestones = [
        m for m in milestones if m.status not in terminal_statuses
    ]
    if open_milestones:
        titles = ", ".join(f"'{m.title}'" for m in open_milestones[:5])
        suffix = (
            f" (and {len(open_milestones) - 5} more)"
            if len(open_milestones) > 5
            else ""
        )
        raise InvalidTransitionError(
            f"Cannot complete program: {len(open_milestones)} milestone(s) are not "
            f"completed or cancelled: {titles}{suffix}. "
            "All milestones must be in 'completed' or 'cancelled' status."
        )


async def _check_completed_to_closed(
    db: AsyncSession,
    program: Program,
) -> None:
    """completed → closed requires a ProgramClosure with status 'completed'."""
    result = await db.execute(
        select(ProgramClosure).where(ProgramClosure.program_id == program.id)
    )
    closure = result.scalar_one_or_none()

    if closure is None:
        raise InvalidTransitionError(
            "Cannot close program: no closure record found. "
            "Initiate and complete the closure checklist first."
        )
    if closure.status != "completed":
        raise InvalidTransitionError(
            f"Cannot close program: closure checklist status is '{closure.status}', "
            "but must be 'completed'. Finish all closure checklist items first."
        )


# Map specific transitions to their precondition checks
_PRECONDITION_CHECKS: dict[
    tuple[ProgramStatus, ProgramStatus],
    list[object],
] = {
    (ProgramStatus.design, ProgramStatus.active): [_check_design_to_active],
    (ProgramStatus.active, ProgramStatus.completed): [_check_active_to_completed],
    (ProgramStatus.completed, ProgramStatus.closed): [_check_completed_to_closed],
}


async def validate_status_transition(
    db: AsyncSession,
    program: Program,
    new_status_raw: str,
) -> ProgramStatus:
    """Validate that a program can move from its current status to *new_status_raw*.

    Returns the resolved ProgramStatus on success.
    Raises ``InvalidTransitionError`` (HTTP 422) on failure.
    """
    current = _resolve_status(program.status)
    target = _resolve_status(new_status_raw)

    if current == target:
        # No-op transition — allow silently
        return target

    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if target not in allowed:
        allowed_names = ", ".join(sorted(s.value for s in allowed)) or "none"
        raise InvalidTransitionError(
            f"Invalid status transition: '{current.value}' → '{target.value}'. "
            f"Allowed transitions from '{current.value}': {allowed_names}."
        )

    # Run precondition checks for this specific transition
    checks = _PRECONDITION_CHECKS.get((current, target), [])
    for check_fn in checks:
        await check_fn(db, program)  # type: ignore[operator]

    return target
