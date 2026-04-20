"""Dashboard aggregation service — efficient cross-model queries."""

import json
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import String, cast, func, literal, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.redis import redis_client
from app.models.approval import ProgramApproval
from app.models.communication import Communication
from app.models.deliverable import Deliverable
from app.models.escalation import Escalation
from app.models.milestone import Milestone
from app.models.notification import Notification
from app.models.program import Program
from app.models.sla_tracker import SLATracker
from app.models.task import Task
from app.models.user import User
from app.schemas.dashboard import (
    ActivityFeedItem,
    DashboardAlert,
    RealTimeStats,
)

logger = logging.getLogger(__name__)

CACHE_TTL = 30  # seconds


async def _get_cached(key: str) -> Any | None:
    """Try to get cached data from Redis."""
    try:
        data = await redis_client.get(key)
        if data:
            return json.loads(data)
    except Exception:
        logger.debug("Redis cache miss or unavailable for key=%s", key)
    return None


async def _set_cached(key: str, data: dict[str, Any] | list[Any], ttl: int = CACHE_TTL) -> None:
    """Try to cache data in Redis."""
    try:
        await redis_client.set(key, json.dumps(data, default=str), ex=ttl)
    except Exception:
        logger.debug("Redis cache write failed for key=%s", key)


async def get_real_time_stats(db: AsyncSession, user_id: uuid.UUID) -> RealTimeStats:
    """Get live dashboard counts."""
    cache_key = f"dashboard:realtime:{user_id}"
    cached = await _get_cached(cache_key)
    if cached:
        return RealTimeStats(**cached)

    now = datetime.now(UTC)
    seven_days = now + timedelta(days=7)

    # Active programs
    active_result = await db.execute(
        select(func.count(Program.id)).where(
            Program.status.in_(["active", "design", "intake", "on_hold"])
        )
    )
    active_programs = active_result.scalar_one()

    # Pending approvals
    approvals_result = await db.execute(
        select(func.count(ProgramApproval.id)).where(ProgramApproval.status == "pending")
    )
    pending_approvals = approvals_result.scalar_one()

    # Open escalations
    esc_result = await db.execute(
        select(func.count(Escalation.id)).where(Escalation.status.in_(["open", "acknowledged"]))
    )
    open_escalations = esc_result.scalar_one()

    # SLA breaches
    sla_result = await db.execute(
        select(func.count(SLATracker.id)).where(
            SLATracker.breach_status.in_(["breached", "approaching_breach"])
        )
    )
    sla_breaches = sla_result.scalar_one()

    # Unread notifications for current user
    notif_result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        )
    )
    unread_notifications = notif_result.scalar_one()

    # Upcoming deadlines (milestones due within 7 days)
    deadline_result = await db.execute(
        select(func.count(Milestone.id)).where(
            Milestone.due_date.isnot(None),
            Milestone.due_date <= seven_days.date(),
            Milestone.due_date >= now.date(),
            Milestone.status != "completed",
        )
    )
    upcoming_deadlines = deadline_result.scalar_one()

    stats = RealTimeStats(
        active_programs=active_programs,
        pending_approvals=pending_approvals,
        open_escalations=open_escalations,
        sla_breaches=sla_breaches,
        unread_notifications=unread_notifications,
        upcoming_deadlines=upcoming_deadlines,
    )

    await _set_cached(cache_key, stats.model_dump())
    return stats


async def get_activity_feed(
    db: AsyncSession, skip: int = 0, limit: int = 50
) -> tuple[list[ActivityFeedItem], int]:
    """Get recent activity feed across entities."""
    cache_key = f"dashboard:activity:{skip}:{limit}"
    cached = await _get_cached(cache_key)
    if cached:
        return [ActivityFeedItem(**i) for i in cached["items"]], cached["total"]

    # Build UNION ALL of the three activity sources so sorting and pagination
    # happen in a single SQL round-trip instead of three separate queries.
    user_alias_comm = User.__table__.alias("u_comm")
    user_alias_esc = User.__table__.alias("u_esc")
    user_alias_deliv = User.__table__.alias("u_deliv")

    comm_sel = (
        select(
            cast(Communication.id, String).label("id"),
            literal("communication").label("activity_type"),
            (
                literal("Communication sent: ") + func.coalesce(Communication.subject, "No subject")
            ).label("title"),
            (literal("Sent via ") + cast(Communication.channel, String)).label("description"),
            literal("communication").label("entity_type"),
            cast(Communication.id, String).label("entity_id"),
            Communication.created_at.label("timestamp"),
            user_alias_comm.c.full_name.label("actor_name"),
            (literal("/communications/") + cast(Communication.id, String)).label("link"),
        )
        .outerjoin(user_alias_comm, Communication.sender_id == user_alias_comm.c.id)
        .where(Communication.status == "sent")
    )

    esc_sel = select(
        cast(Escalation.id, String).label("id"),
        literal("escalation").label("activity_type"),
        (literal("Escalation: ") + Escalation.title).label("title"),
        (
            literal("Status: ")
            + cast(Escalation.status, String)
            + literal(" | Level: ")
            + cast(Escalation.level, String)
        ).label("description"),
        literal("escalation").label("entity_type"),
        cast(Escalation.id, String).label("entity_id"),
        Escalation.triggered_at.label("timestamp"),
        user_alias_esc.c.full_name.label("actor_name"),
        (literal("/escalations/") + cast(Escalation.id, String)).label("link"),
    ).outerjoin(user_alias_esc, Escalation.triggered_by == user_alias_esc.c.id)

    deliv_sel = (
        select(
            cast(Deliverable.id, String).label("id"),
            literal("deliverable_submission").label("activity_type"),
            (literal("Deliverable submitted: ") + Deliverable.title).label("title"),
            (literal("Status: ") + cast(Deliverable.status, String)).label("description"),
            literal("deliverable").label("entity_type"),
            cast(Deliverable.id, String).label("entity_id"),
            Deliverable.submitted_at.label("timestamp"),
            user_alias_deliv.c.full_name.label("actor_name"),
            (literal("/deliverables/") + cast(Deliverable.id, String)).label("link"),
        )
        .outerjoin(user_alias_deliv, Deliverable.submitted_by == user_alias_deliv.c.id)
        .where(Deliverable.submitted_at.isnot(None))
    )

    combined = union_all(comm_sel, esc_sel, deliv_sel).subquery()

    # Count total rows without skip/limit
    count_result = await db.execute(select(func.count()).select_from(combined))
    total: int = count_result.scalar_one()

    # Fetch paginated, sorted page
    feed_result = await db.execute(
        select(combined).order_by(combined.c.timestamp.desc()).offset(skip).limit(limit)
    )
    items: list[ActivityFeedItem] = [
        ActivityFeedItem(
            id=row.id,
            activity_type=row.activity_type,
            title=row.title,
            description=row.description,
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            timestamp=row.timestamp,
            actor_name=row.actor_name,
            link=row.link,
        )
        for row in feed_result.all()
    ]

    await _set_cached(
        cache_key,
        {"items": [i.model_dump(mode="json") for i in items], "total": total},
    )
    return items, total


async def get_dashboard_alerts(
    db: AsyncSession,
) -> tuple[list[DashboardAlert], int]:
    """Get actionable alerts for the dashboard."""
    cache_key = "dashboard:alerts"
    cached = await _get_cached(cache_key)
    if cached:
        return [DashboardAlert(**a) for a in cached["alerts"]], cached["total"]

    alerts: list[DashboardAlert] = []
    today = datetime.now(UTC).date()

    # SLA breaches / approaching breach
    sla_result = await db.execute(
        select(SLATracker)
        .where(SLATracker.breach_status.in_(["breached", "approaching_breach"]))
        .order_by(SLATracker.started_at.asc())
        .limit(50)
    )
    for sla in sla_result.scalars().all():
        severity = "critical" if sla.breach_status == "breached" else "warning"
        alerts.append(
            DashboardAlert(
                id=f"sla-{sla.id}",
                severity=severity,
                alert_type="sla_breach",
                title=f"SLA {sla.breach_status.replace('_', ' ').title()}",
                description=(
                    f"{sla.entity_type} SLA ({sla.sla_hours}h) — {sla.communication_type}"
                ),
                entity_type=sla.entity_type,
                entity_id=sla.entity_id,
                link="/sla",
                due_date=sla.started_at,
            )
        )

    # Overdue tasks
    task_result = await db.execute(
        select(Task)
        .where(
            Task.status != "completed",
            Task.due_date.isnot(None),
            Task.due_date < today,
        )
        .order_by(Task.due_date.asc())
        .limit(50)
    )
    for task in task_result.scalars().all():
        due_str = task.due_date.isoformat() if task.due_date else "N/A"
        due_dt = datetime.combine(task.due_date, datetime.min.time()) if task.due_date else None
        alerts.append(
            DashboardAlert(
                id=f"task-{task.id}",
                severity="warning",
                alert_type="overdue_task",
                title=f"Overdue Task: {task.title}",
                description=f"Due: {due_str}",
                entity_type="task",
                entity_id=str(task.id),
                link=f"/tasks/{task.id}",
                due_date=due_dt,
            )
        )

    # Pending approval reviews
    approval_result = await db.execute(
        select(ProgramApproval)
        .where(ProgramApproval.status == "pending")
        .order_by(ProgramApproval.created_at.asc())
        .limit(50)
    )
    for approval in approval_result.scalars().all():
        alerts.append(
            DashboardAlert(
                id=f"approval-{approval.id}",
                severity="info",
                alert_type="pending_review",
                title=f"Pending Approval: {approval.approval_type}",
                description="Program approval awaiting review",
                entity_type="approval",
                entity_id=str(approval.id),
                link="/approvals",
                due_date=approval.created_at,
            )
        )

    # Sort by severity (critical first)
    severity_order = {"critical": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda x: severity_order.get(x.severity, 3))
    total = len(alerts)

    await _set_cached(
        cache_key,
        {
            "alerts": [a.model_dump(mode="json") for a in alerts],
            "total": total,
        },
    )
    return alerts, total
