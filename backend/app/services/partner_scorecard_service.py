"""Partner scorecard service — time-period-aware performance metrics for partner portal."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.partner import PartnerProfile
from app.models.partner_assignment import PartnerAssignment
from app.models.partner_rating import PartnerRating
from app.models.sla_tracker import SLATracker


def _period_since(period: str) -> datetime:
    """Return the start datetime for the given period string."""
    now = datetime.now(UTC)
    if period == "30d":
        return now - timedelta(days=30)
    if period == "90d":
        return now - timedelta(days=90)
    if period == "ytd":
        return datetime(now.year, 1, 1, tzinfo=UTC)
    # Fallback: 90 days
    return now - timedelta(days=90)


def _iso_week_start(dt: date) -> str:
    monday = dt - timedelta(days=dt.weekday())
    return monday.isoformat()


async def get_partner_scorecard(  # noqa: PLR0912, PLR0915
    db: AsyncSession,
    partner_id: uuid.UUID,
    period: str = "90d",
) -> dict[str, Any] | None:
    """Return a full scorecard for a partner over the given period.

    period must be one of: "30d", "90d", "ytd".
    """
    partner_result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    partner = partner_result.scalar_one_or_none()
    if not partner:
        return None

    since = _period_since(period)

    # ── SLA compliance ────────────────────────────────────────────────────────
    sla_total = 0
    sla_breached = 0
    sla_compliance_pct: float | None = None

    if partner.user_id:
        sla_result = await db.execute(
            select(
                func.count(SLATracker.id).label("total"),
                func.count(case((SLATracker.breach_status == "breached", SLATracker.id))).label(
                    "breached"
                ),
            ).where(
                SLATracker.assigned_to == partner.user_id,
                SLATracker.started_at >= since,
            )
        )
        sla_row = sla_result.one()
        sla_total = sla_row.total or 0
        sla_breached = sla_row.breached or 0
        if sla_total > 0:
            sla_compliance_pct = round((1 - sla_breached / sla_total) * 100, 1)
        else:
            sla_compliance_pct = None  # no data → show N/A

    # ── Rating metrics ────────────────────────────────────────────────────────
    rating_result = await db.execute(
        select(
            func.avg(PartnerRating.quality_score).label("avg_quality"),
            func.avg(PartnerRating.timeliness_score).label("avg_timeliness"),
            func.avg(PartnerRating.communication_score).label("avg_communication"),
            func.avg(PartnerRating.overall_score).label("avg_overall"),
            func.count(PartnerRating.id).label("total_ratings"),
        ).where(
            PartnerRating.partner_id == partner_id,
            PartnerRating.created_at >= since,
        )
    )
    rrow = rating_result.one()
    avg_quality = round(float(rrow.avg_quality), 2) if rrow.avg_quality else None
    avg_timeliness = round(float(rrow.avg_timeliness), 2) if rrow.avg_timeliness else None
    avg_communication = round(float(rrow.avg_communication), 2) if rrow.avg_communication else None
    avg_overall = round(float(rrow.avg_overall), 2) if rrow.avg_overall else None
    total_ratings = rrow.total_ratings or 0

    # ── Assignment stats ──────────────────────────────────────────────────────
    assign_result = await db.execute(
        select(PartnerAssignment).where(
            PartnerAssignment.partner_id == partner_id,
            PartnerAssignment.created_at >= since,
        )
    )
    assignments = assign_result.scalars().all()

    total_assignments = len(assignments)
    completed_assignments = sum(1 for a in assignments if str(a.status) == "completed")

    # On-time delivery rate: completed before or on due_date
    on_time_count = 0
    late_count = 0
    response_times_hours: list[float] = []

    for a in assignments:
        # Response time: dispatched → accepted
        if a.accepted_at and a.created_at:
            created = a.created_at
            accepted = a.accepted_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=UTC)
            if accepted.tzinfo is None:
                accepted = accepted.replace(tzinfo=UTC)
            delta_h = (accepted - created).total_seconds() / 3600
            if delta_h >= 0:
                response_times_hours.append(delta_h)

        # On-time delivery
        if str(a.status) == "completed" and a.completed_at and a.due_date:
            completed_dt = a.completed_at
            if completed_dt.tzinfo is None:
                completed_dt = completed_dt.replace(tzinfo=UTC)
            # due_date is a Date; convert to end-of-day UTC
            due_dt = datetime(
                a.due_date.year, a.due_date.month, a.due_date.day, 23, 59, 59, tzinfo=UTC
            )
            if completed_dt <= due_dt:
                on_time_count += 1
            else:
                late_count += 1

    avg_response_time_hours: float | None = (
        round(sum(response_times_hours) / len(response_times_hours), 1)
        if response_times_hours
        else None
    )

    deliveries_with_due = on_time_count + late_count
    on_time_delivery_rate: float | None = (
        round(on_time_count / deliveries_with_due * 100, 1) if deliveries_with_due > 0 else None
    )

    # ── Composite score (60% rating + 40% SLA) ───────────────────────────────
    rating_component = (avg_overall * 20) if avg_overall else None
    composite_score: float | None = None
    if rating_component is not None and sla_compliance_pct is not None:
        composite_score = round(0.6 * rating_component + 0.4 * sla_compliance_pct, 1)
    elif rating_component is not None:
        composite_score = round(rating_component, 1)
    elif sla_compliance_pct is not None:
        composite_score = round(sla_compliance_pct, 1)

    # ── Weekly trend data ─────────────────────────────────────────────────────
    data_points = await _build_weekly_trends(db, partner_id, partner, since)

    # ── Platform-wide averages for comparison ─────────────────────────────────
    averages = await _get_platform_averages(db, since)

    return {
        "partner_id": str(partner.id),
        "firm_name": str(partner.firm_name),
        "period": period,
        "metrics": {
            "composite_score": composite_score,
            "sla_compliance_pct": sla_compliance_pct,
            "avg_response_time_hours": avg_response_time_hours,
            "quality_score": avg_quality,
            "on_time_delivery_rate": on_time_delivery_rate,
            "client_satisfaction": avg_overall,
        },
        "rating_breakdown": {
            "avg_quality": avg_quality,
            "avg_timeliness": avg_timeliness,
            "avg_communication": avg_communication,
            "avg_overall": avg_overall,
        },
        "totals": {
            "total_assignments": total_assignments,
            "completed_assignments": completed_assignments,
            "total_sla_checked": sla_total,
            "total_sla_breached": sla_breached,
            "total_ratings": total_ratings,
        },
        "averages": averages,
        "data_points": data_points,
    }


async def _build_weekly_trends(
    db: AsyncSession,
    partner_id: uuid.UUID,
    partner: PartnerProfile,
    since: datetime,
) -> list[dict[str, Any]]:
    """Build weekly trend buckets for the scorecard."""
    now = datetime.now(UTC)
    since_date = since.date()
    today = now.date()

    # Gather weekly SLA data
    sla_by_week: dict[str, tuple[int, int]] = {}
    if partner.user_id:
        sla_result = await db.execute(
            select(SLATracker).where(
                SLATracker.assigned_to == partner.user_id,
                SLATracker.started_at >= since,
            )
        )
        for sla_row in sla_result.scalars().all():
            started = sla_row.started_at
            if started.tzinfo is None:
                started = started.replace(tzinfo=UTC)
            wk = _iso_week_start(started.date())
            t, b = sla_by_week.get(wk, (0, 0))
            t += 1
            if str(sla_row.breach_status) == "breached":
                b += 1
            sla_by_week[wk] = (t, b)

    # Gather weekly rating data
    from dataclasses import dataclass, field

    @dataclass
    class RatingAccum:
        quality: list[float] = field(default_factory=list)
        overall: list[float] = field(default_factory=list)

    ratings_by_week: dict[str, RatingAccum] = {}
    rating_result = await db.execute(
        select(PartnerRating).where(
            PartnerRating.partner_id == partner_id,
            PartnerRating.created_at >= since,
        )
    )
    for r in rating_result.scalars().all():
        rc = r.created_at
        if rc.tzinfo is None:
            rc = rc.replace(tzinfo=UTC)
        wk = _iso_week_start(rc.date())
        if wk not in ratings_by_week:
            ratings_by_week[wk] = RatingAccum()
        ratings_by_week[wk].quality.append(float(r.quality_score))
        ratings_by_week[wk].overall.append(float(r.overall_score))

    # Gather weekly completions
    completions_by_week: dict[str, int] = {}
    assign_result = await db.execute(
        select(PartnerAssignment).where(
            PartnerAssignment.partner_id == partner_id,
            PartnerAssignment.completed_at >= since,
        )
    )
    for a in assign_result.scalars().all():
        if not a.completed_at or not isinstance(a.completed_at, datetime):
            continue
        ca = a.completed_at
        if ca.tzinfo is None:
            ca = ca.replace(tzinfo=UTC)
        wk = _iso_week_start(ca.date())
        completions_by_week[wk] = completions_by_week.get(wk, 0) + 1

    # Build weekly buckets
    from app.services.partner_trends_service import _weeks_in_range

    weeks = _weeks_in_range(since_date, today)
    data_points: list[dict[str, Any]] = []
    for week_monday in weeks:
        wk = week_monday.isoformat()
        sla_total, sla_breached = sla_by_week.get(wk, (0, 0))
        sla_pct = round((1 - sla_breached / sla_total) * 100, 1) if sla_total > 0 else None
        accum = ratings_by_week.get(wk)
        avg_q = (
            round(sum(accum.quality) / len(accum.quality), 2) if accum and accum.quality else None
        )
        avg_o = (
            round(sum(accum.overall) / len(accum.overall), 2) if accum and accum.overall else None
        )
        data_points.append(
            {
                "week_start": wk,
                "sla_compliance_pct": sla_pct,
                "avg_quality": avg_q,
                "avg_overall": avg_o,
                "assignments_completed": completions_by_week.get(wk, 0),
            }
        )

    return data_points


async def _get_platform_averages(
    db: AsyncSession,
    since: datetime,
) -> dict[str, Any]:
    """Compute platform-wide averages for the same period (for comparison)."""
    # SLA compliance across all partners
    sla_result = await db.execute(
        select(
            func.count(SLATracker.id).label("total"),
            func.count(case((SLATracker.breach_status == "breached", SLATracker.id))).label(
                "breached"
            ),
        ).where(SLATracker.started_at >= since)
    )
    sla_row = sla_result.one()
    sla_total = sla_row.total or 0
    sla_breached = sla_row.breached or 0
    avg_sla = round((1 - sla_breached / sla_total) * 100, 1) if sla_total > 0 else None

    # Rating averages across all partners
    rating_result = await db.execute(
        select(
            func.avg(PartnerRating.quality_score).label("avg_quality"),
            func.avg(PartnerRating.overall_score).label("avg_overall"),
        ).where(PartnerRating.created_at >= since)
    )
    rrow = rating_result.one()
    avg_quality = round(float(rrow.avg_quality), 2) if rrow.avg_quality else None
    avg_overall = round(float(rrow.avg_overall), 2) if rrow.avg_overall else None

    # Platform composite
    rating_component = (avg_overall * 20) if avg_overall else None
    platform_composite: float | None = None
    if rating_component is not None and avg_sla is not None:
        platform_composite = round(0.6 * rating_component + 0.4 * avg_sla, 1)
    elif rating_component is not None:
        platform_composite = round(rating_component, 1)
    elif avg_sla is not None:
        platform_composite = round(avg_sla, 1)

    return {
        "composite_score": platform_composite,
        "sla_compliance_pct": avg_sla,
        "quality_score": avg_quality,
        "client_satisfaction": avg_overall,
    }
