"""Partner comparison service — aggregates metrics for side-by-side comparison."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.partner import PartnerProfile
from app.models.partner_assignment import PartnerAssignment
from app.models.partner_rating import PartnerRating
from app.models.sla_tracker import SLATracker
from app.schemas.partner import PartnerComparisonItem, PartnerComparisonResponse


async def _get_partner_comparison_item(
    db: AsyncSession,
    partner: PartnerProfile,
) -> PartnerComparisonItem:
    """Aggregate all comparison metrics for a single partner."""
    partner_id: uuid.UUID = partner.id  # type: ignore[assignment]

    # ── Rating scores ─────────────────────────────────────────────────────────
    rating_result = await db.execute(
        select(
            func.avg(PartnerRating.quality_score).label("avg_quality"),
            func.avg(PartnerRating.timeliness_score).label("avg_timeliness"),
            func.avg(PartnerRating.communication_score).label("avg_communication"),
            func.avg(PartnerRating.overall_score).label("avg_overall"),
            func.count(PartnerRating.id).label("total_ratings"),
        ).where(PartnerRating.partner_id == partner_id)
    )
    rrow = rating_result.one()

    avg_quality = round(float(rrow.avg_quality), 2) if rrow.avg_quality else None
    avg_timeliness = round(float(rrow.avg_timeliness), 2) if rrow.avg_timeliness else None
    avg_communication = round(float(rrow.avg_communication), 2) if rrow.avg_communication else None
    avg_overall = round(float(rrow.avg_overall), 2) if rrow.avg_overall else None
    total_ratings: int = rrow.total_ratings or 0

    # ── SLA compliance ────────────────────────────────────────────────────────
    sla_compliance_rate: float | None = None
    total_sla_tracked = 0
    total_sla_breached = 0

    user_id: uuid.UUID | None = partner.user_id  # type: ignore[assignment]
    if user_id:
        sla_result = await db.execute(
            select(
                func.count(SLATracker.id).label("total"),
                func.count(
                    case((SLATracker.breach_status == "breached", SLATracker.id))
                ).label("breached"),
            ).where(SLATracker.assigned_to == user_id)
        )
        srow = sla_result.one()
        total_sla_tracked = srow.total or 0
        total_sla_breached = srow.breached or 0
        if total_sla_tracked > 0:
            sla_compliance_rate = round(
                (1 - total_sla_breached / total_sla_tracked) * 100, 2
            )
        else:
            sla_compliance_rate = 100.0

    # ── Assignment stats ──────────────────────────────────────────────────────
    assign_result = await db.execute(
        select(
            func.count(PartnerAssignment.id).label("total"),
            func.count(
                case((PartnerAssignment.status == "completed", PartnerAssignment.id))
            ).label("completed"),
            func.count(
                case(
                    (
                        PartnerAssignment.status.in_(
                            ["accepted", "in_progress", "dispatched"]
                        ),
                        PartnerAssignment.id,
                    )
                )
            ).label("active"),
        ).where(PartnerAssignment.partner_id == partner_id)
    )
    arow = assign_result.one()
    total_assignments: int = arow.total or 0
    completed_assignments: int = arow.completed or 0
    active_assignments: int = arow.active or 0

    # Capacity utilisation (active / max_concurrent)
    max_concurrent: int = partner.max_concurrent_assignments or 5  # type: ignore[assignment]
    capacity_utilisation = round(active_assignments / max_concurrent * 100, 1)
    remaining_capacity = max(0, max_concurrent - active_assignments)

    # ── Composite score (60% rating + 40% SLA) ────────────────────────────────
    rating_component = (avg_overall * 20) if avg_overall else None  # scale 1–5 → 0–100
    composite_score: float | None = None
    if rating_component is not None and sla_compliance_rate is not None:
        composite_score = round(0.6 * rating_component + 0.4 * sla_compliance_rate, 2)
    elif rating_component is not None:
        composite_score = round(rating_component, 2)
    elif sla_compliance_rate is not None:
        composite_score = round(sla_compliance_rate, 2)

    # ── Recent 90-day trend (avg overall rating) ──────────────────────────────
    since_90 = datetime.now(UTC) - timedelta(days=90)
    trend_result = await db.execute(
        select(func.avg(PartnerRating.overall_score).label("avg_recent")).where(
            PartnerRating.partner_id == partner_id,
            PartnerRating.created_at >= since_90,
        )
    )
    trow = trend_result.one()
    avg_recent_overall = round(float(trow.avg_recent), 2) if trow.avg_recent else None

    # Trend direction: compare recent 90-day avg vs all-time avg
    trend_direction: str = "neutral"
    if avg_recent_overall is not None and avg_overall is not None:
        diff = avg_recent_overall - avg_overall
        if diff >= 0.2:
            trend_direction = "up"
        elif diff <= -0.2:
            trend_direction = "down"

    return PartnerComparisonItem(
        partner_id=str(partner_id),
        firm_name=str(partner.firm_name),
        contact_name=str(partner.contact_name),
        availability_status=str(partner.availability_status),
        status=str(partner.status),
        capabilities=list(partner.capabilities or []),
        geographies=list(partner.geographies or []),
        compliance_verified=bool(partner.compliance_verified),
        # Ratings
        avg_quality=avg_quality,
        avg_timeliness=avg_timeliness,
        avg_communication=avg_communication,
        avg_overall=avg_overall,
        total_ratings=total_ratings,
        # SLA
        sla_compliance_rate=sla_compliance_rate,
        total_sla_tracked=total_sla_tracked,
        total_sla_breached=total_sla_breached,
        # Assignments
        total_assignments=total_assignments,
        completed_assignments=completed_assignments,
        active_assignments=active_assignments,
        # Capacity
        max_concurrent_assignments=max_concurrent,
        capacity_utilisation=capacity_utilisation,
        remaining_capacity=remaining_capacity,
        # Composite + trend
        composite_score=composite_score,
        avg_recent_overall=avg_recent_overall,
        trend_direction=trend_direction,
    )


async def get_partner_comparison_data(
    db: AsyncSession,
    partner_ids: list[uuid.UUID],
) -> PartnerComparisonResponse:
    """Aggregate comparison metrics for the given list of partners."""
    # Fetch all partners in one query
    result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id.in_(partner_ids))
    )
    partners = result.scalars().all()

    # Preserve request order
    partner_map = {str(p.id): p for p in partners}
    ordered_partners = [
        partner_map[str(pid)] for pid in partner_ids if str(pid) in partner_map
    ]

    items = [
        await _get_partner_comparison_item(db, p) for p in ordered_partners
    ]

    return PartnerComparisonResponse(partners=items)
