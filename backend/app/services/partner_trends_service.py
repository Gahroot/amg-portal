"""Partner trends service — aggregates partner performance data over time."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.partner import PartnerProfile
from app.models.partner_assignment import PartnerAssignment
from app.models.partner_governance import PartnerGovernance
from app.models.partner_rating import PartnerRating
from app.models.performance_notice import PerformanceNotice
from app.models.sla_tracker import SLATracker


@dataclass
class TrendDataPoint:
    """A single data point in the trend series (weekly bucket)."""

    week_start: str  # ISO date string (Monday of the week)
    sla_compliance_pct: float | None
    avg_quality: float | None
    avg_timeliness: float | None
    avg_communication: float | None
    avg_overall: float | None
    completion_rate: float | None  # completed / (completed + failed) for the week
    sla_total: int
    sla_breached: int
    ratings_count: int
    assignments_completed: int


@dataclass
class TrendAnnotation:
    """A significant event annotated on the chart."""

    date: str  # ISO date string
    event_type: str  # "governance" | "notice" | "rating"
    label: str
    severity: str | None = None  # for notices: "minor" | "major" | "critical"


@dataclass
class PartnerTrends:
    """Full trend response for a partner."""

    partner_id: str
    firm_name: str
    days: int
    data_points: list[TrendDataPoint] = field(default_factory=list)
    annotations: list[TrendAnnotation] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)


def _iso_week_start(dt: date) -> str:
    """Return the ISO Monday for the week containing dt."""
    monday = dt - timedelta(days=dt.weekday())
    return monday.isoformat()


def _weeks_in_range(start: date, end: date) -> list[date]:
    """Yield the Monday of each week from start to end (inclusive)."""
    monday = start - timedelta(days=start.weekday())
    weeks = []
    while monday <= end:
        weeks.append(monday)
        monday += timedelta(weeks=1)
    return weeks


async def get_partner_trends(  # noqa: PLR0912, PLR0915
    db: AsyncSession,
    partner_id: uuid.UUID,
    days: int = 90,
) -> PartnerTrends | None:
    """Return weekly performance trend data for a partner over the last N days."""
    # Fetch partner
    partner_result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id == partner_id)
    )
    partner = partner_result.scalar_one_or_none()
    if not partner:
        return None

    now = datetime.now(UTC)
    since = now - timedelta(days=days)
    since_date = since.date()
    today = now.date()

    # ── SLA compliance by week ────────────────────────────────────────────────
    # Map: week_start_str → (total, breached)
    sla_by_week: dict[str, tuple[int, int]] = {}

    if partner.user_id:
        sla_result = await db.execute(
            select(SLATracker).where(
                SLATracker.assigned_to == partner.user_id,
                SLATracker.started_at >= since,
            )
        )
        sla_rows = sla_result.scalars().all()
        for sla_row in sla_rows:
            started: datetime = sla_row.started_at
            if started.tzinfo is None:
                started = started.replace(tzinfo=UTC)
            week_key = _iso_week_start(started.date())
            total, breached = sla_by_week.get(week_key, (0, 0))
            total += 1
            if str(sla_row.breach_status) == "breached":
                breached += 1
            sla_by_week[week_key] = (total, breached)

    # ── Ratings by week ───────────────────────────────────────────────────────
    @dataclass
    class RatingAccum:
        quality: list[float] = field(default_factory=list)
        timeliness: list[float] = field(default_factory=list)
        communication: list[float] = field(default_factory=list)
        overall: list[float] = field(default_factory=list)

    ratings_by_week: dict[str, RatingAccum] = {}

    rating_result = await db.execute(
        select(PartnerRating).where(
            PartnerRating.partner_id == partner_id,
            PartnerRating.created_at >= since,
        )
    )
    rating_rows = rating_result.scalars().all()
    for rating_row in rating_rows:
        rating_created: datetime = rating_row.created_at
        if rating_created.tzinfo is None:
            rating_created = rating_created.replace(tzinfo=UTC)
        week_key = _iso_week_start(rating_created.date())
        if week_key not in ratings_by_week:
            ratings_by_week[week_key] = RatingAccum()
        ratings_by_week[week_key].quality.append(float(rating_row.quality_score))
        ratings_by_week[week_key].timeliness.append(float(rating_row.timeliness_score))
        ratings_by_week[week_key].communication.append(float(rating_row.communication_score))
        ratings_by_week[week_key].overall.append(float(rating_row.overall_score))

    # ── Assignment completion by week ─────────────────────────────────────────
    # Map: week_start_str → completed count (by completed_at date)
    completions_by_week: dict[str, int] = {}

    assignment_result = await db.execute(
        select(PartnerAssignment).where(
            PartnerAssignment.partner_id == partner_id,
            PartnerAssignment.completed_at >= since,
        )
    )
    assignment_rows = assignment_result.scalars().all()
    for assign_row in assignment_rows:
        if assign_row.completed_at is None:
            continue
        assign_completed_raw = assign_row.completed_at
        if not isinstance(assign_completed_raw, datetime):
            continue
        assign_completed = assign_completed_raw
        if assign_completed.tzinfo is None:
            assign_completed = assign_completed.replace(tzinfo=UTC)
        week_key = _iso_week_start(assign_completed.date())
        completions_by_week[week_key] = completions_by_week.get(week_key, 0) + 1

    # Total assignments started this period (for completion rate denominator)
    total_assigned_result = await db.execute(
        select(func.count(PartnerAssignment.id)).where(
            PartnerAssignment.partner_id == partner_id,
            PartnerAssignment.created_at >= since,
        )
    )
    total_assigned = total_assigned_result.scalar_one() or 0
    total_completed = sum(completions_by_week.values())
    completion_rate_overall = (
        round(total_completed / total_assigned * 100, 1) if total_assigned else None
    )

    # ── Build data points per week ────────────────────────────────────────────
    weeks = _weeks_in_range(since_date, today)
    data_points: list[TrendDataPoint] = []

    for week_monday in weeks:
        week_key = week_monday.isoformat()
        sla_total, sla_breached = sla_by_week.get(week_key, (0, 0))
        sla_compliance = (
            round((1 - sla_breached / sla_total) * 100, 1) if sla_total > 0 else None
        )
        accum = ratings_by_week.get(week_key)
        avg_quality = (
            round(sum(accum.quality) / len(accum.quality), 2)
            if accum and accum.quality
            else None
        )
        avg_timeliness = (
            round(sum(accum.timeliness) / len(accum.timeliness), 2)
            if accum and accum.timeliness
            else None
        )
        avg_communication = (
            round(sum(accum.communication) / len(accum.communication), 2)
            if accum and accum.communication
            else None
        )
        avg_overall = (
            round(sum(accum.overall) / len(accum.overall), 2)
            if accum and accum.overall
            else None
        )
        completed_this_week = completions_by_week.get(week_key, 0)

        data_points.append(
            TrendDataPoint(
                week_start=week_key,
                sla_compliance_pct=sla_compliance,
                avg_quality=avg_quality,
                avg_timeliness=avg_timeliness,
                avg_communication=avg_communication,
                avg_overall=avg_overall,
                completion_rate=None,  # filled below as running cumulative if desired
                sla_total=sla_total,
                sla_breached=sla_breached,
                ratings_count=len(accum.overall) if accum else 0,
                assignments_completed=completed_this_week,
            )
        )

    # ── Annotations: governance actions ──────────────────────────────────────
    annotations: list[TrendAnnotation] = []

    gov_result = await db.execute(
        select(PartnerGovernance).where(
            PartnerGovernance.partner_id == partner_id,
            PartnerGovernance.effective_date >= since,
        )
    )
    gov_rows = gov_result.scalars().all()
    for gov_row in gov_rows:
        eff: datetime = gov_row.effective_date
        if eff.tzinfo is None:
            eff = eff.replace(tzinfo=UTC)
        annotations.append(
            TrendAnnotation(
                date=eff.date().isoformat(),
                event_type="governance",
                label=str(gov_row.action).replace("_", " ").title(),
            )
        )

    # Annotations: performance notices
    notice_result = await db.execute(
        select(PerformanceNotice).where(
            PerformanceNotice.partner_id == partner_id,
            PerformanceNotice.created_at >= since,
        )
    )
    notice_rows = notice_result.scalars().all()
    for notice_row in notice_rows:
        notice_created: datetime = notice_row.created_at
        if notice_created.tzinfo is None:
            notice_created = notice_created.replace(tzinfo=UTC)
        annotations.append(
            TrendAnnotation(
                date=notice_created.date().isoformat(),
                event_type="notice",
                label=str(notice_row.notice_type).replace("_", " ").title(),
                severity=str(notice_row.severity),
            )
        )

    # ── Summary stats ─────────────────────────────────────────────────────────
    # Overall SLA compliance across entire period
    all_sla_total = sum(v[0] for v in sla_by_week.values())
    all_sla_breached = sum(v[1] for v in sla_by_week.values())
    overall_sla = (
        round((1 - all_sla_breached / all_sla_total) * 100, 1)
        if all_sla_total > 0
        else None
    )

    # Overall quality average
    all_quality = [s for a in ratings_by_week.values() for s in a.quality]
    overall_quality = round(sum(all_quality) / len(all_quality), 2) if all_quality else None

    summary = {
        "overall_sla_compliance_pct": overall_sla,
        "overall_avg_quality": overall_quality,
        "total_completed_assignments": total_completed,
        "total_assigned": total_assigned,
        "completion_rate_pct": completion_rate_overall,
        "total_sla_checked": all_sla_total,
        "total_sla_breached": all_sla_breached,
    }

    return PartnerTrends(
        partner_id=str(partner.id),
        firm_name=str(partner.firm_name),
        days=days,
        data_points=data_points,
        annotations=annotations,
        summary=summary,
    )
