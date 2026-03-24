"""Partner capacity and availability service.

Computes per-date capacity usage for partners based on active assignments
(those with a due_date and not yet completed/cancelled) and blocked dates.
"""

from datetime import date, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import Date, and_, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import AssignmentStatus
from app.models.partner import PartnerBlockedDate, PartnerProfile
from app.models.partner_assignment import PartnerAssignment

# Statuses that count toward active capacity
ACTIVE_STATUSES = {
    AssignmentStatus.draft,
    AssignmentStatus.dispatched,
    AssignmentStatus.accepted,
    AssignmentStatus.in_progress,
}


async def get_capacity_heatmap(
    db: AsyncSession,
    partner_id: UUID,
    start_date: date,
    end_date: date,
) -> dict[str, dict[str, Any]]:
    """Return a daily capacity map from start_date to end_date (inclusive).

    Each key is an ISO date string; value is a dict with:
      - active_assignments: int — number of active assignments covering that date
      - max_concurrent: int — partner's max concurrent capacity
      - is_blocked: bool — partner manually blocked this date
      - block_reason: str | None
      - utilisation: float — active_assignments / max_concurrent (capped at 1.0)
      - status: "available" | "partial" | "full" | "blocked"
    """
    # Fetch partner to get max_concurrent
    result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    partner = result.scalar_one_or_none()
    if partner is None:
        return {}

    max_concurrent: int = partner.max_concurrent_assignments or 5  # type: ignore[assignment]

    # Fetch active assignments that have a due_date within or before end_date.
    # An assignment is active on any day from created_at.date() to due_date (inclusive).
    assignments_result = await db.execute(
        select(PartnerAssignment).where(
            and_(
                PartnerAssignment.partner_id == partner_id,
                PartnerAssignment.status.in_([s.value for s in ACTIVE_STATUSES]),
                PartnerAssignment.due_date.isnot(None),
                PartnerAssignment.due_date >= start_date,
            )
        )
    )
    assignments = assignments_result.scalars().all()

    # Fetch blocked dates within range
    blocked_result = await db.execute(
        select(PartnerBlockedDate).where(
            and_(
                PartnerBlockedDate.partner_id == partner_id,
                PartnerBlockedDate.blocked_date >= start_date,
                PartnerBlockedDate.blocked_date <= end_date,
            )
        )
    )
    blocked_rows = blocked_result.scalars().all()
    blocked_map: dict[date, str | None] = {
        row.blocked_date: row.reason  # type: ignore[misc]
        for row in blocked_rows
    }

    # Build per-day counts
    day_counts: dict[date, int] = {}
    current = start_date
    while current <= end_date:
        day_counts[current] = 0
        current += timedelta(days=1)

    for assignment in assignments:
        a_due: date = assignment.due_date  # type: ignore[assignment]
        a_start = assignment.created_at.date()
        window_start = max(a_start, start_date)
        window_end = min(a_due, end_date)
        d = window_start
        while d <= window_end:
            if d in day_counts:
                day_counts[d] += 1
            d += timedelta(days=1)

    # Assemble result
    heatmap: dict[str, dict[str, Any]] = {}
    current = start_date
    while current <= end_date:
        count = day_counts.get(current, 0)
        is_blocked = current in blocked_map
        block_reason = blocked_map.get(current)
        utilisation = min(count / max_concurrent, 1.0) if max_concurrent > 0 else 1.0

        if is_blocked:
            status = "blocked"
        elif count >= max_concurrent:
            status = "full"
        elif count > 0:
            status = "partial"
        else:
            status = "available"

        heatmap[current.isoformat()] = {
            "active_assignments": count,
            "max_concurrent": max_concurrent,
            "is_blocked": is_blocked,
            "block_reason": block_reason,
            "utilisation": round(utilisation, 4),
            "status": status,
        }
        current += timedelta(days=1)

    return heatmap


async def get_all_partners_capacity_summary(
    db: AsyncSession,
    target_date: date,
) -> list[dict[str, Any]]:
    """Return a capacity summary for every active partner on a specific date.

    Used for the admin overview to spot bottlenecks at a glance.
    """
    # Count active assignments per partner that cover target_date
    subq = (
        select(
            PartnerAssignment.partner_id,
            func.count(PartnerAssignment.id).label("active_count"),
        )
        .where(
            and_(
                PartnerAssignment.status.in_([s.value for s in ACTIVE_STATUSES]),
                PartnerAssignment.due_date.isnot(None),
                PartnerAssignment.due_date >= target_date,
                cast(PartnerAssignment.created_at, Date) <= target_date,
            )
        )
        .group_by(PartnerAssignment.partner_id)
        .subquery()
    )

    result = await db.execute(
        select(
            PartnerProfile.id,
            PartnerProfile.firm_name,
            PartnerProfile.contact_name,
            PartnerProfile.availability_status,
            PartnerProfile.max_concurrent_assignments,
            subq.c.active_count,
        )
        .outerjoin(subq, PartnerProfile.id == subq.c.partner_id)
        .where(PartnerProfile.status == "active")
        .order_by(PartnerProfile.firm_name)
    )
    rows = result.all()

    # Fetch blocked partners for target_date
    blocked_result = await db.execute(
        select(PartnerBlockedDate.partner_id).where(
            PartnerBlockedDate.blocked_date == target_date
        )
    )
    blocked_ids = {row[0] for row in blocked_result.all()}

    summaries: list[dict[str, Any]] = []
    for row in rows:
        active: int = row.active_count or 0
        max_c: int = row.max_concurrent_assignments or 5
        is_blocked: bool = row.id in blocked_ids
        utilisation = min(active / max_c, 1.0) if max_c > 0 else 1.0

        if is_blocked:
            status = "blocked"
        elif active >= max_c:
            status = "full"
        elif active > 0:
            status = "partial"
        else:
            status = "available"

        summaries.append({
            "partner_id": str(row.id),
            "firm_name": row.firm_name,
            "contact_name": row.contact_name,
            "availability_status": row.availability_status,
            "active_assignments": active,
            "max_concurrent": max_c,
            "is_blocked": is_blocked,
            "utilisation": round(utilisation, 4),
            "status": status,
        })

    return summaries
