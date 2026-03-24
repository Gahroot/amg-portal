"""Partner availability / capacity-blocker endpoints.

Partners can declare date ranges they are unavailable (blockers).
Internal staff (RM+) can view and manage blockers for any partner.
When a blocker is created, any active assignments whose due_date falls
inside the range are returned as conflicts so the RM can take action.
"""

from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, select

from app.api.deps import (
    DB,
    CurrentUser,
    require_internal,
)
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.partner import PartnerProfile
from app.models.partner_assignment import PartnerAssignment
from app.models.partner_blocker import PartnerBlocker
from app.models.program import Program
from app.models.user import User
from app.schemas.partner_blocker import (
    BlockerConflict,
    PartnerAvailabilityDay,
    PartnerAvailabilityResponse,
    PartnerBlockerCreate,
    PartnerBlockerCreateResponse,
    PartnerBlockerResponse,
)

router = APIRouter()

# Assignment statuses that count as "active" for conflict detection
_ACTIVE_STATUSES = {"draft", "dispatched", "accepted", "in_progress"}


# ── Helpers ───────────────────────────────────────────────────────────────────


def _blocker_covers_date(blocker: PartnerBlocker, d: date) -> bool:
    """Return True if the blocker covers a specific date."""
    start: date = blocker.start_date  # type: ignore[assignment]
    end: date = blocker.end_date  # type: ignore[assignment]
    if not (start <= d <= end):
        return False
    if not blocker.is_recurring:
        return True
    # Weekly recurrence — check ISO weekday (1=Mon … 7=Sun)
    if blocker.recurrence_type == "weekly":
        days: list[int] = blocker.recurrence_days or []  # type: ignore[assignment]
        return d.isoweekday() in days
    return True


async def _get_partner_or_raise(db: DB, partner_id: UUID) -> PartnerProfile:
    result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    partner = result.scalar_one_or_none()
    if partner is None:
        raise NotFoundException("Partner not found")
    return partner


async def _assert_can_manage(db: DB, current_user: User, partner_id: UUID) -> None:
    """Ensure current_user may manage blockers for partner_id.

    Partners may only manage their own; internal staff may manage any.
    """
    if current_user.role == "partner":
        result = await db.execute(
            select(PartnerProfile).where(PartnerProfile.user_id == current_user.id)
        )
        profile = result.scalar_one_or_none()
        if profile is None or str(profile.id) != str(partner_id):
            raise NotFoundException("Partner not found")


async def _detect_conflicts(
    db: DB,
    partner_id: UUID,
    blocker: PartnerBlocker,
) -> list[BlockerConflict]:
    """Find active assignments whose due_date falls inside the blocker range."""
    start: date = blocker.start_date  # type: ignore[assignment]
    end: date = blocker.end_date  # type: ignore[assignment]

    result = await db.execute(
        select(PartnerAssignment, Program.title.label("program_title"))
        .join(Program, PartnerAssignment.program_id == Program.id, isouter=True)
        .where(
            and_(
                PartnerAssignment.partner_id == partner_id,
                PartnerAssignment.status.in_(list(_ACTIVE_STATUSES)),
                PartnerAssignment.due_date.isnot(None),
                PartnerAssignment.due_date >= start,
                PartnerAssignment.due_date <= end,
            )
        )
    )
    rows = result.all()

    conflicts: list[BlockerConflict] = []
    for row in rows:
        assignment: PartnerAssignment = row[0]
        program_title: str | None = row[1]
        due: date = assignment.due_date  # type: ignore[assignment]
        if _blocker_covers_date(blocker, due):
            conflicts.append(
                BlockerConflict(
                    assignment_id=assignment.id,
                    assignment_title=assignment.title,
                    program_title=program_title,
                    due_date=due,
                    status=assignment.status,
                )
            )
    return conflicts


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get(
    "/{partner_id}/blockers",
    response_model=list[PartnerBlockerResponse],
)
async def list_blockers(
    partner_id: UUID,
    db: DB,
    current_user: CurrentUser,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    upcoming_only: bool = Query(default=False, description="Only return blockers ending today or later"),
) -> list[PartnerBlockerResponse]:
    """List capacity blockers for a partner.

    Accessible by the partner themselves and by internal staff.
    """
    await _assert_can_manage(db, current_user, partner_id)

    today = date.today()
    filters = [PartnerBlocker.partner_id == partner_id]

    if upcoming_only:
        filters.append(PartnerBlocker.end_date >= today)
    if start_date:
        filters.append(PartnerBlocker.end_date >= start_date)
    if end_date:
        filters.append(PartnerBlocker.start_date <= end_date)

    result = await db.execute(
        select(PartnerBlocker)
        .where(and_(*filters))
        .order_by(PartnerBlocker.start_date)
    )
    rows = result.scalars().all()
    return [PartnerBlockerResponse.model_validate(r) for r in rows]


@router.post(
    "/{partner_id}/blockers",
    response_model=PartnerBlockerCreateResponse,
    status_code=201,
)
async def create_blocker(
    partner_id: UUID,
    data: PartnerBlockerCreate,
    db: DB,
    current_user: CurrentUser,
) -> PartnerBlockerCreateResponse:
    """Declare a new capacity blocker.

    Returns the created blocker plus a list of existing assignments whose
    due_date falls inside the blocked range (so the RM can review them).
    """
    await _assert_can_manage(db, current_user, partner_id)
    await _get_partner_or_raise(db, partner_id)

    blocker = PartnerBlocker(
        partner_id=partner_id,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason,
        blocker_type=data.blocker_type,
        is_recurring=data.is_recurring,
        recurrence_type=data.recurrence_type,
        recurrence_days=data.recurrence_days,
        created_by=current_user.id,
    )
    db.add(blocker)
    await db.flush()  # get blocker.id before conflict check

    conflicts = await _detect_conflicts(db, partner_id, blocker)

    await db.commit()
    await db.refresh(blocker)

    return PartnerBlockerCreateResponse(
        blocker=PartnerBlockerResponse.model_validate(blocker),
        conflicts=conflicts,
    )


@router.delete("/{partner_id}/blockers/{blocker_id}", status_code=204)
async def delete_blocker(
    partner_id: UUID,
    blocker_id: UUID,
    db: DB,
    current_user: CurrentUser,
) -> None:
    """Remove a capacity blocker."""
    await _assert_can_manage(db, current_user, partner_id)

    result = await db.execute(
        select(PartnerBlocker).where(
            and_(
                PartnerBlocker.id == blocker_id,
                PartnerBlocker.partner_id == partner_id,
            )
        )
    )
    blocker = result.scalar_one_or_none()
    if blocker is None:
        raise NotFoundException("Blocker not found")

    await db.delete(blocker)
    await db.commit()


@router.get(
    "/{partner_id}/availability",
    response_model=PartnerAvailabilityResponse,
    dependencies=[Depends(require_internal)],
)
async def get_partner_availability(
    partner_id: UUID,
    db: DB,
    current_user: CurrentUser,
    start_date: date | None = Query(default=None, description="ISO start date (defaults to today)"),
    end_date: date | None = Query(default=None, description="ISO end date (defaults to +60 days)"),
) -> PartnerAvailabilityResponse:
    """Return per-day availability for a partner over a date range.

    Used by RMs when assigning work so they can see which dates are blocked
    before selecting a due date.
    """
    await _get_partner_or_raise(db, partner_id)

    if start_date is None:
        start_date = date.today()
    if end_date is None:
        end_date = start_date + timedelta(days=60)

    if end_date < start_date:
        raise BadRequestException("end_date must be >= start_date")
    if (end_date - start_date).days > 365:
        raise BadRequestException("Date range cannot exceed 365 days")

    # Fetch blockers overlapping the requested range
    result = await db.execute(
        select(PartnerBlocker).where(
            and_(
                PartnerBlocker.partner_id == partner_id,
                PartnerBlocker.start_date <= end_date,
                PartnerBlocker.end_date >= start_date,
            )
        )
    )
    blockers = result.scalars().all()

    days: dict[str, PartnerAvailabilityDay] = {}
    current = start_date
    while current <= end_date:
        iso = current.isoformat()
        blocked_by: PartnerBlocker | None = None
        for b in blockers:
            if _blocker_covers_date(b, current):
                blocked_by = b
                break

        if blocked_by is not None:
            days[iso] = PartnerAvailabilityDay(
                date=current,
                is_blocked=True,
                blocker_id=blocked_by.id,
                blocker_type=blocked_by.blocker_type,
                reason=blocked_by.reason,
                is_recurring=blocked_by.is_recurring,
            )
        else:
            days[iso] = PartnerAvailabilityDay(date=current, is_blocked=False)

        current += timedelta(days=1)

    return PartnerAvailabilityResponse(
        partner_id=partner_id,
        start_date=start_date,
        end_date=end_date,
        days=days,
    )
