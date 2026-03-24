"""Dashboard aggregation service — efficient cross-model queries."""

import json
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
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


async def _set_cached(
    key: str, data: dict[str, Any] | list[Any], ttl: int = CACHE_TTL
) -> None:
    """Try to cache data in Redis."""
    try:
        await redis_client.set(
            key, json.dumps(data, default=str), ex=ttl
        )
    except Exception:
        logger.debug("Redis cache write failed for key=%s", key)


async def get_real_time_stats(
    db: AsyncSession, user_id: uuid.UUID
) -> RealTimeStats:
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
        select(func.count(ProgramApproval.id)).where(
            ProgramApproval.status == "pending"
        )
    )
    pending_approvals = approvals_result.scalar_one()

    # Open escalations
    esc_result = await db.execute(
        select(func.count(Escalation.id)).where(
            Escalation.status.in_(["open", "acknowledged"])
        )
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

    items: list[ActivityFeedItem] = []

    # Recent communications (sent)
    comm_query = (
        select(Communication, User.full_name)
        .outerjoin(User, Communication.sender_id == User.id)
        .where(Communication.status == "sent")
        .order_by(Communication.created_at.desc())
        .limit(limit)
    )
    comm_result = await db.execute(comm_query)
    for comm, sender_name in comm_result.all():
        items.append(ActivityFeedItem(
            id=str(comm.id),
            activity_type="communication",
            title=f"Communication sent: {comm.subject or 'No subject'}",
            description=f"Sent via {comm.channel}",
            entity_type="communication",
            entity_id=str(comm.id),
            timestamp=comm.created_at,
            actor_name=sender_name,
            link=f"/communications/{comm.id}",
        ))

    # Recent escalations
    esc_query = (
        select(Escalation, User.full_name)
        .outerjoin(User, Escalation.triggered_by == User.id)
        .order_by(Escalation.triggered_at.desc())
        .limit(limit)
    )
    esc_result = await db.execute(esc_query)
    for esc, actor_name in esc_result.all():
        items.append(ActivityFeedItem(
            id=str(esc.id),
            activity_type="escalation",
            title=f"Escalation: {esc.title}",
            description=f"Status: {esc.status} | Level: {esc.level}",
            entity_type="escalation",
            entity_id=str(esc.id),
            timestamp=esc.triggered_at,
            actor_name=actor_name,
            link=f"/escalations/{esc.id}",
        ))

    # Recent deliverable submissions
    deliv_query = (
        select(Deliverable, User.full_name)
        .outerjoin(User, Deliverable.submitted_by == User.id)
        .where(Deliverable.submitted_at.isnot(None))
        .order_by(Deliverable.submitted_at.desc())
        .limit(limit)
    )
    deliv_result = await db.execute(deliv_query)
    for deliv, actor_name in deliv_result.all():
        items.append(ActivityFeedItem(
            id=str(deliv.id),
            activity_type="deliverable_submission",
            title=f"Deliverable submitted: {deliv.title}",
            description=f"Status: {deliv.status}",
            entity_type="deliverable",
            entity_id=str(deliv.id),
            timestamp=deliv.submitted_at,
            actor_name=actor_name,
            link=f"/deliverables/{deliv.id}",
        ))

    # Sort all by timestamp desc, take top `limit`
    items.sort(key=lambda x: x.timestamp, reverse=True)
    total = len(items)
    items = items[skip : skip + limit]

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
        .where(
            SLATracker.breach_status.in_(
                ["breached", "approaching_breach"]
            )
        )
        .order_by(SLATracker.started_at.asc())
        .limit(50)
    )
    for sla in sla_result.scalars().all():
        severity = (
            "critical" if sla.breach_status == "breached" else "warning"
        )
        alerts.append(DashboardAlert(
            id=f"sla-{sla.id}",
            severity=severity,
            alert_type="sla_breach",
            title=f"SLA {sla.breach_status.replace('_', ' ').title()}",
            description=(
                f"{sla.entity_type} SLA ({sla.sla_hours}h)"
                f" — {sla.communication_type}"
            ),
            entity_type=sla.entity_type,
            entity_id=sla.entity_id,
            link="/sla",
            due_date=sla.started_at,
        ))

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
        due_dt = (
            datetime.combine(task.due_date, datetime.min.time())
            if task.due_date
            else None
        )
        alerts.append(DashboardAlert(
            id=f"task-{task.id}",
            severity="warning",
            alert_type="overdue_task",
            title=f"Overdue Task: {task.title}",
            description=f"Due: {due_str}",
            entity_type="task",
            entity_id=str(task.id),
            link=f"/tasks/{task.id}",
            due_date=due_dt,
        ))

    # Pending approval reviews
    approval_result = await db.execute(
        select(ProgramApproval)
        .where(ProgramApproval.status == "pending")
        .order_by(ProgramApproval.created_at.asc())
        .limit(50)
    )
    for approval in approval_result.scalars().all():
        alerts.append(DashboardAlert(
            id=f"approval-{approval.id}",
            severity="info",
            alert_type="pending_review",
            title=f"Pending Approval: {approval.approval_type}",
            description="Program approval awaiting review",
            entity_type="approval",
            entity_id=str(approval.id),
            link="/approvals",
            due_date=approval.created_at,
        ))

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
