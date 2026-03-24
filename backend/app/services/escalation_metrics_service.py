"""Escalation metrics service — aggregates resolution time, frequency, and trend data."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from typing import cast as typing_cast
from uuid import UUID

from sqlalchemy import Integer, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.escalation import Escalation
from app.models.user import User

_LEVELS = ["task", "milestone", "program", "client_impact"]


def _base_q(
    q: Any,
    date_from: datetime | None,
    date_to: datetime | None,
    level: str | None,
    status: str | None,
    owner_id: UUID | None,
) -> Any:
    """Apply common filters to any select query."""
    if date_from:
        q = q.where(Escalation.triggered_at >= date_from)
    if date_to:
        q = q.where(Escalation.triggered_at <= date_to)
    if level:
        q = q.where(Escalation.level == level)
    if status:
        q = q.where(Escalation.status == status)
    if owner_id:
        q = q.where(Escalation.owner_id == owner_id)
    return q


def _epoch_avg(col_diff: Any) -> Any:
    return func.avg(cast(func.extract("epoch", col_diff), Integer))


async def _compute_summary(
    db: AsyncSession,
    date_from: datetime | None,
    date_to: datetime | None,
    level: str | None,
    status: str | None,
    owner_id: UUID | None,
) -> dict[str, Any]:
    """Headline counts + timing averages."""

    def f(q: Any) -> Any:
        return _base_q(q, date_from, date_to, level, status, owner_id)

    total: int = (
        await db.execute(f(select(func.count(Escalation.id))))
    ).scalar_one() or 0

    open_count: int = (
        await db.execute(
            f(select(func.count(Escalation.id))).where(
                Escalation.status.in_(["open", "acknowledged", "investigating"])
            )
        )
    ).scalar_one() or 0

    resolved_count: int = (
        await db.execute(
            f(select(func.count(Escalation.id))).where(Escalation.status == "resolved")
        )
    ).scalar_one() or 0

    res_diff = Escalation.resolved_at - Escalation.triggered_at
    res_guard = Escalation.resolved_at.isnot(None)
    res_secs = (
        await db.execute(f(select(_epoch_avg(res_diff)).where(res_guard)))
    ).scalar_one()
    avg_resolution_hours: float | None = round(res_secs / 3600, 1) if res_secs else None

    ttfr_diff = Escalation.acknowledged_at - Escalation.triggered_at
    ttfr_guard = Escalation.acknowledged_at.isnot(None)
    ttfr_secs = (
        await db.execute(f(select(_epoch_avg(ttfr_diff)).where(ttfr_guard)))
    ).scalar_one()
    avg_ttfr_hours: float | None = round(ttfr_secs / 3600, 1) if ttfr_secs else None

    return {
        "total": total,
        "open": open_count,
        "resolved": resolved_count,
        "avg_resolution_hours": avg_resolution_hours,
        "avg_time_to_response_hours": avg_ttfr_hours,
    }


async def _compute_breakdowns(
    db: AsyncSession,
    date_from: datetime | None,
    date_to: datetime | None,
    level: str | None,
    status: str | None,
    owner_id: UUID | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Returns by_level, by_status, by_entity_type, by_assignee."""

    def f(q: Any) -> Any:
        return _base_q(q, date_from, date_to, level, status, owner_id)

    cnt = func.count(Escalation.id).label("count")

    level_q = f(select(Escalation.level, cnt).group_by(Escalation.level))
    by_level = [
        {"level": r.level, "count": r.count}
        for r in (await db.execute(level_q)).all()
    ]

    status_q = f(select(Escalation.status, cnt).group_by(Escalation.status))
    by_status = [
        {"status": r.status, "count": r.count}
        for r in (await db.execute(status_q)).all()
    ]

    entity_q = f(select(Escalation.entity_type, cnt).group_by(Escalation.entity_type))
    by_entity_type = [
        {"entity_type": r.entity_type, "count": r.count}
        for r in (await db.execute(entity_q)).all()
    ]

    assignee_q = f(
        select(
            Escalation.owner_id,
            User.full_name.label("owner_name"),
            User.email.label("owner_email"),
            cnt,
        )
        .join(User, User.id == Escalation.owner_id, isouter=True)
        .group_by(Escalation.owner_id, User.full_name, User.email)
        .order_by(func.count(Escalation.id).desc())
        .limit(10)
    )
    by_assignee = [
        {
            "owner_id": str(r.owner_id),
            "owner_name": r.owner_name,
            "owner_email": r.owner_email,
            "count": r.count,
        }
        for r in (await db.execute(assignee_q)).all()
    ]

    return by_level, by_status, by_entity_type, by_assignee


async def _compute_trend(
    db: AsyncSession,
    effective_from: datetime,
    effective_to: datetime,
    level: str | None,
    owner_id: UUID | None,
) -> list[dict[str, Any]]:
    """Weekly trend pivot: [{week, task, milestone, program, client_impact, total}]."""
    week_col = func.date_trunc("week", Escalation.triggered_at).label("week")
    trend_q = (
        select(week_col, Escalation.level, func.count(Escalation.id).label("count"))
        .where(Escalation.triggered_at >= effective_from)
        .where(Escalation.triggered_at <= effective_to)
        .group_by(func.date_trunc("week", Escalation.triggered_at), Escalation.level)
        .order_by(func.date_trunc("week", Escalation.triggered_at))
    )
    if level:
        trend_q = trend_q.where(Escalation.level == level)
    if owner_id:
        trend_q = trend_q.where(Escalation.owner_id == owner_id)

    trend_map: dict[str, dict[str, int]] = {}
    for row in (await db.execute(trend_q)).all():
        week_key = row.week.date().isoformat()
        if week_key not in trend_map:
            zero = typing_cast(dict[str, int], dict.fromkeys(_LEVELS, 0))
            zero["total"] = 0
            trend_map[week_key] = zero
        trend_map[week_key][row.level] = row.count  # type: ignore[assignment]
        trend_map[week_key]["total"] += row.count  # type: ignore[operator]

    return [{"week": week, **counts} for week, counts in sorted(trend_map.items())]


async def _compute_recurring(
    db: AsyncSession,
    date_from: datetime | None,
    date_to: datetime | None,
    level: str | None,
) -> list[dict[str, Any]]:
    """Entity+level combos that recurred ≥ 2 times."""
    q = (
        select(
            Escalation.entity_type,
            Escalation.entity_id,
            Escalation.level,
            func.count(Escalation.id).label("count"),
        )
        .group_by(Escalation.entity_type, Escalation.entity_id, Escalation.level)
        .having(func.count(Escalation.id) >= 2)
        .order_by(func.count(Escalation.id).desc())
        .limit(20)
    )
    if date_from:
        q = q.where(Escalation.triggered_at >= date_from)
    if date_to:
        q = q.where(Escalation.triggered_at <= date_to)
    if level:
        q = q.where(Escalation.level == level)

    return [
        {
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "level": r.level,
            "count": r.count,
        }
        for r in (await db.execute(q)).all()
    ]


def _build_insights(
    summary: dict[str, Any],
    by_level: list[dict[str, Any]],
    recurring_patterns: list[dict[str, Any]],
) -> list[str]:
    insights: list[str] = []
    total = summary["total"]
    if total == 0:
        insights.append("No escalations found for the selected period.")
        return insights

    resolved_count = summary["resolved"]
    resolution_rate = round(resolved_count / total * 100, 1)
    if resolution_rate < 50:
        insights.append(
            f"Only {resolution_rate}% of escalations are resolved. "
            "Consider reviewing the backlog and assigning resources."
        )
    elif resolution_rate >= 80:
        insights.append(
            f"{resolution_rate}% resolution rate — strong performance in this period."
        )

    avg_res = summary["avg_resolution_hours"]
    if avg_res is not None and avg_res > 72:
        insights.append(
            f"Average resolution time is {avg_res}h (>72h). "
            "Investigate bottlenecks in the resolution workflow."
        )

    avg_ttfr = summary["avg_time_to_response_hours"]
    if avg_ttfr is not None and avg_ttfr > 24:
        insights.append(
            f"Average time to first response is {avg_ttfr}h (>24h). "
            "Owners may need to improve acknowledgement speed."
        )

    client_impact = next(
        (b["count"] for b in by_level if b["level"] == "client_impact"), 0
    )
    if client_impact > 0:
        insights.append(
            f"{client_impact} client-impact escalation(s) detected — "
            "these require immediate MD attention."
        )

    if recurring_patterns:
        insights.append(
            f"{len(recurring_patterns)} entity/entities have recurring escalations "
            "— review root causes to prevent repeat issues."
        )

    return insights


async def get_escalation_metrics(
    db: AsyncSession,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    level: str | None = None,
    status: str | None = None,
    owner_id: UUID | None = None,
) -> dict[str, Any]:
    """
    Compute escalation metrics for the dashboard.

    Returns summary, by_level, by_status, by_entity_type, by_assignee,
    trend, recurring_patterns, insights, and benchmark vs prior period.
    """
    effective_from = date_from or (datetime.now(UTC) - timedelta(days=90))
    effective_to = date_to or datetime.now(UTC)

    summary = await _compute_summary(db, date_from, date_to, level, status, owner_id)
    by_level, by_status, by_entity_type, by_assignee = await _compute_breakdowns(
        db, date_from, date_to, level, status, owner_id
    )
    trend = await _compute_trend(db, effective_from, effective_to, level, owner_id)
    recurring_patterns = await _compute_recurring(db, date_from, date_to, level)
    insights = _build_insights(summary, by_level, recurring_patterns)

    # Benchmark: % change vs prior period
    period_days = max((effective_to - effective_from).days, 1)
    prior_from = effective_from - timedelta(days=period_days)
    prior_total: int = (
        await db.execute(
            select(func.count(Escalation.id))
            .where(Escalation.triggered_at >= prior_from)
            .where(Escalation.triggered_at < effective_from)
        )
    ).scalar_one() or 0

    change_pct: float | None = None
    total = summary["total"]
    if prior_total > 0:
        change_pct = round((total - prior_total) / prior_total * 100, 1)
    elif total > 0:
        change_pct = 100.0

    summary["change_vs_prior_period_pct"] = change_pct
    summary["prior_period_total"] = prior_total

    return {
        "summary": summary,
        "by_level": by_level,
        "by_status": by_status,
        "by_entity_type": by_entity_type,
        "by_assignee": by_assignee,
        "trend": trend,
        "recurring_patterns": recurring_patterns,
        "insights": insights,
    }
