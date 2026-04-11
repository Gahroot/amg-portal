"""Read-side escalation queries: filters, owner-info enrichment, metrics."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EscalationLevel, EscalationStatus
from app.models.escalation import Escalation
from app.models.user import User


async def get_active_escalations(
    db: AsyncSession,
    program_id: UUID | None = None,
    client_id: UUID | None = None,
    level: EscalationLevel | None = None,
    status: EscalationStatus | None = None,
) -> list[Escalation]:
    """Query escalations with filters."""
    q: Select[tuple[Escalation]] = select(Escalation)

    if program_id:
        q = q.where(Escalation.program_id == program_id)
    if client_id:
        q = q.where(Escalation.client_id == client_id)
    if level:
        q = q.where(Escalation.level == level.value)
    if status:
        q = q.where(Escalation.status == status.value)
    else:
        # Default to open/acknowledged/investigating
        q = q.where(
            Escalation.status.in_(
                [
                    EscalationStatus.open.value,
                    EscalationStatus.acknowledged.value,
                    EscalationStatus.investigating.value,
                ]
            )
        )

    q = q.order_by(Escalation.triggered_at.desc())

    result = await db.execute(q)
    return list(result.scalars().all())


async def get_escalations_with_owner_info(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    level: str | None = None,
    status: str | None = None,
    program_id: UUID | None = None,
    client_id: UUID | None = None,
    search: str | None = None,
) -> tuple[list[dict[str, object]], int]:
    """Get escalations with owner and triggerer user info for API responses."""
    q = select(Escalation)

    if level:
        q = q.where(Escalation.level == level)
    if status:
        q = q.where(Escalation.status == status)
    if program_id:
        q = q.where(Escalation.program_id == program_id)
    if client_id:
        q = q.where(Escalation.client_id == client_id)
    if search:
        q = q.where(Escalation.title.ilike(f"%{search}%"))

    # Count total
    count_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = count_result.scalar_one()

    q = q.order_by(Escalation.triggered_at.desc()).offset(skip).limit(limit)

    result = await db.execute(q)
    escalations = result.scalars().all()

    # Batch-load owners and triggerers to avoid N+1
    user_ids = {esc.owner_id for esc in escalations if esc.owner_id}
    user_ids |= {esc.triggered_by for esc in escalations if esc.triggered_by}
    users_map: dict[object, User] = {}
    if user_ids:
        users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_map = {u.id: u for u in users_result.scalars().all()}

    escalation_data = []
    for esc in escalations:
        owner = users_map.get(esc.owner_id)
        triggerer = users_map.get(esc.triggered_by)

        esc_dict = {
            "id": esc.id,
            "level": esc.level,
            "status": esc.status,
            "title": esc.title,
            "description": esc.description,
            "entity_type": esc.entity_type,
            "entity_id": esc.entity_id,
            "owner_id": esc.owner_id,
            "owner_email": owner.email if owner else None,
            "owner_name": owner.full_name if owner else None,
            "program_id": esc.program_id,
            "client_id": esc.client_id,
            "triggered_at": esc.triggered_at,
            "acknowledged_at": esc.acknowledged_at,
            "resolved_at": esc.resolved_at,
            "closed_at": esc.closed_at,
            "triggered_by": esc.triggered_by,
            "triggered_by_email": triggerer.email if triggerer else None,
            "triggered_by_name": triggerer.full_name if triggerer else None,
            "risk_factors": esc.risk_factors,
            "escalation_chain": esc.escalation_chain,
            "resolution_notes": esc.resolution_notes,
            "created_at": esc.created_at,
            "updated_at": esc.updated_at,
            "response_deadline": esc.response_deadline,
            "is_overdue": esc.is_overdue,
        }
        escalation_data.append(esc_dict)

    return escalation_data, total


async def get_escalation_chain(
    db: AsyncSession,
    escalation_id: UUID,
) -> dict[str, object]:
    """Get the escalation chain history for a given escalation."""
    result = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    escalation = result.scalar_one_or_none()
    if not escalation:
        raise ValueError(f"Escalation {escalation_id} not found")

    chain = escalation.escalation_chain or []
    return {
        "escalation_id": escalation.id,
        "current_level": escalation.level,
        "chain": chain,
        "total_entries": len(chain),
    }


async def get_simple_escalation_metrics(db: AsyncSession) -> dict[str, object]:
    """Return concise metrics: open counts by level, avg resolution hours, overdue count, trends."""
    now = datetime.now(UTC)
    week_start = now - timedelta(days=7)
    prev_week_start = now - timedelta(days=14)

    active_statuses = [
        EscalationStatus.open.value,
        EscalationStatus.acknowledged.value,
        EscalationStatus.investigating.value,
    ]

    # Open count by level
    open_by_level: dict[str, int] = {}
    for level_name in ("task", "milestone", "program", "client_impact"):
        count_result = await db.execute(
            select(func.count(Escalation.id)).where(
                Escalation.level == level_name,
                Escalation.status.in_(active_statuses),
            )
        )
        open_by_level[level_name] = count_result.scalar_one() or 0

    # Average resolution time (hours) for escalations resolved in last 30 days
    thirty_days_ago = now - timedelta(days=30)
    resolved_result = await db.execute(
        select(Escalation.triggered_at, Escalation.resolved_at).where(
            Escalation.resolved_at.isnot(None),
            Escalation.resolved_at >= thirty_days_ago,
        )
    )
    resolved_rows = resolved_result.all()
    avg_resolution_hours: float | None = None
    if resolved_rows:
        total_hours = sum(
            (row.resolved_at - row.triggered_at).total_seconds() / 3600
            for row in resolved_rows
        )
        avg_resolution_hours = round(total_hours / len(resolved_rows), 1)

    # Overdue count (deadline past, still active)
    overdue_result = await db.execute(
        select(func.count(Escalation.id)).where(
            Escalation.response_deadline.isnot(None),
            Escalation.response_deadline < now,
            Escalation.status.in_(active_statuses),
        )
    )
    overdue_count: int = overdue_result.scalar_one() or 0

    # SLA compliance (escalations that were acknowledged within deadline)
    total_with_deadline_result = await db.execute(
        select(func.count(Escalation.id)).where(
            Escalation.response_deadline.isnot(None),
            Escalation.triggered_at >= thirty_days_ago,
        )
    )
    total_with_deadline: int = total_with_deadline_result.scalar_one() or 0
    sla_compliance_pct: float | None = None
    if total_with_deadline > 0:
        on_time_result = await db.execute(
            select(func.count(Escalation.id)).where(
                Escalation.response_deadline.isnot(None),
                Escalation.triggered_at >= thirty_days_ago,
                Escalation.acknowledged_at.isnot(None),
                Escalation.acknowledged_at <= Escalation.response_deadline,
            )
        )
        on_time: int = on_time_result.scalar_one() or 0
        sla_compliance_pct = round(on_time / total_with_deadline * 100, 1)

    # Weekly trend counts
    this_week_result = await db.execute(
        select(func.count(Escalation.id)).where(Escalation.triggered_at >= week_start)
    )
    trend_this_week: int = this_week_result.scalar_one() or 0

    last_week_result = await db.execute(
        select(func.count(Escalation.id)).where(
            Escalation.triggered_at >= prev_week_start,
            Escalation.triggered_at < week_start,
        )
    )
    trend_last_week: int = last_week_result.scalar_one() or 0

    return {
        "open_by_level": open_by_level,
        "avg_resolution_time_hours": avg_resolution_hours,
        "overdue_count": overdue_count,
        "sla_compliance_pct": sla_compliance_pct,
        "trend_this_week": trend_this_week,
        "trend_last_week": trend_last_week,
    }


async def get_overdue_escalations(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[dict[str, object]], int]:
    """Get escalations where response_deadline has passed and status is still active."""
    now = datetime.now(UTC)
    active_statuses = [
        EscalationStatus.open.value,
        EscalationStatus.acknowledged.value,
        EscalationStatus.investigating.value,
    ]

    q = select(Escalation).where(
        Escalation.response_deadline.isnot(None),
        Escalation.response_deadline < now,
        Escalation.status.in_(active_statuses),
    )

    count_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = count_result.scalar_one()

    q = q.order_by(Escalation.response_deadline.asc()).offset(skip).limit(limit)
    result = await db.execute(q)
    escalations = result.scalars().all()

    # Batch-load owners and triggerers to avoid N+1
    overdue_user_ids = {esc.owner_id for esc in escalations if esc.owner_id}
    overdue_user_ids |= {esc.triggered_by for esc in escalations if esc.triggered_by}
    overdue_users_map: dict[object, User] = {}
    if overdue_user_ids:
        overdue_users_result = await db.execute(
            select(User).where(User.id.in_(overdue_user_ids))
        )
        overdue_users_map = {u.id: u for u in overdue_users_result.scalars().all()}

    escalation_data = []
    for esc in escalations:
        owner = overdue_users_map.get(esc.owner_id)
        triggerer = overdue_users_map.get(esc.triggered_by)

        esc_dict: dict[str, object] = {
            "id": esc.id,
            "level": esc.level,
            "status": esc.status,
            "title": esc.title,
            "description": esc.description,
            "entity_type": esc.entity_type,
            "entity_id": esc.entity_id,
            "owner_id": esc.owner_id,
            "owner_email": owner.email if owner else None,
            "owner_name": owner.full_name if owner else None,
            "program_id": esc.program_id,
            "client_id": esc.client_id,
            "triggered_at": esc.triggered_at,
            "acknowledged_at": esc.acknowledged_at,
            "resolved_at": esc.resolved_at,
            "closed_at": esc.closed_at,
            "triggered_by": esc.triggered_by,
            "triggered_by_email": triggerer.email if triggerer else None,
            "triggered_by_name": triggerer.full_name if triggerer else None,
            "risk_factors": esc.risk_factors,
            "escalation_chain": esc.escalation_chain,
            "resolution_notes": esc.resolution_notes,
            "created_at": esc.created_at,
            "updated_at": esc.updated_at,
            "response_deadline": esc.response_deadline,
            "is_overdue": esc.is_overdue,
        }
        escalation_data.append(esc_dict)

    return escalation_data, total
