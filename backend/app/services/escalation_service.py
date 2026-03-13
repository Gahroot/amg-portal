"""Escalation business logic — risk detection, owner determination, status workflows."""

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EscalationLevel, EscalationStatus
from app.models.escalation import Escalation
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.task import Task
from app.models.user import User

logger = logging.getLogger(__name__)

# SLA response-time thresholds per escalation level (hours).
# When an escalation at a given level exceeds this duration without adequate
# response, it is automatically promoted to the next level.
_LEVEL_SLA_HOURS: dict[EscalationLevel, float] = {
    EscalationLevel.task: 1.0,        # 1 hour to acknowledge
    EscalationLevel.milestone: 4.0,   # 4 hours to resolve
    EscalationLevel.program: 4.0,     # 4 hours to resolve
    # client_impact is the terminal level — no further promotion
}

# Ordered promotion path.
_PROMOTION_ORDER: list[EscalationLevel] = [
    EscalationLevel.task,
    EscalationLevel.milestone,
    EscalationLevel.program,
    EscalationLevel.client_impact,
]


async def create_escalation(
    db: AsyncSession,
    entity_type: str,
    entity_id: str,
    level: EscalationLevel,
    triggered_by: User,
    title: str,
    description: str | None = None,
    risk_factors: dict[str, object] | None = None,
    program_id: UUID | None = None,
    client_id: UUID | None = None,
) -> Escalation:
    """Create escalation and determine owner based on level + entity."""
    owner_id = await determine_escalation_owner(db, level, entity_type, entity_id)

    escalation = Escalation(
        level=level.value,
        status=EscalationStatus.open.value,
        title=title,
        description=description,
        entity_type=entity_type,
        entity_id=entity_id,
        owner_id=owner_id,
        triggered_by=triggered_by.id,
        risk_factors=risk_factors,
        program_id=program_id,
        client_id=client_id,
        escalation_chain=[
            {
                "action": "triggered",
                "at": datetime.now(UTC).isoformat(),
                "by": triggered_by.email,
            }
        ],
    )
    db.add(escalation)
    await db.commit()
    await db.refresh(escalation)

    logger.info(
        f"Escalation created: {escalation.id} - {level.value} for {entity_type}:{entity_id}"
    )
    return escalation


async def determine_escalation_owner(
    db: AsyncSession,
    level: EscalationLevel,
    entity_type: str,
    entity_id: str,
) -> UUID:
    """
    Determine owner based on escalation chain:
    - task: task.assigned_to or milestone.program.creator (coordinator)
    - milestone: program.creator (coordinator) or client.rm
    - program: client.rm or managing_director
    - client_impact: managing_director
    """
    if level == EscalationLevel.client_impact:
        # Find managing director
        result = await db.execute(
            select(User.id)
            .where(User.role == "managing_director")
            .order_by(User.created_at)
            .limit(1)
        )
        owner_id = result.scalar_one_or_none()

    elif level == EscalationLevel.program:
        # Find relationship manager or fallback to managing director
        result = await db.execute(
            select(User.id)
            .where(User.role == "relationship_manager")
            .order_by(User.created_at)
            .limit(1)
        )
        owner_id = result.scalar_one_or_none()

    elif level == EscalationLevel.milestone:
        # Find coordinator (program creator) or RM
        if entity_type == "milestone":
            result = await db.execute(
                select(Program.created_by)
                .join(Milestone, Milestone.program_id == Program.id)
                .where(Milestone.id == entity_id)
            )
            owner_id = result.scalar_one_or_none()
        else:
            result = await db.execute(
                select(User.id)
                .where(User.role == "relationship_manager")
                .order_by(User.created_at)
                .limit(1)
            )
            owner_id = result.scalar_one_or_none()

    # Task assignee or program coordinator
    elif entity_type == "task":
        result = await db.execute(select(Task.assigned_to).where(Task.id == entity_id))
        owner_id = result.scalar_one_or_none()

        if not owner_id:
            # Fallback to program creator
            result = await db.execute(
                select(Program.created_by)
                .join(Milestone, Milestone.program_id == Program.id)
                .join(Task, Task.milestone_id == Milestone.id)
                .where(Task.id == entity_id)
            )
            owner_id = result.scalar_one_or_none()
    else:
        result = await db.execute(
            select(User.id).where(User.role == "coordinator").order_by(User.created_at).limit(1)
        )
        owner_id = result.scalar_one_or_none()

    # Ultimate fallback to first managing director
    if owner_id is None:
        result = await db.execute(
            select(User.id)
            .where(User.role == "managing_director")
            .order_by(User.created_at)
            .limit(1)
        )
        owner_id = result.scalar_one_or_none()

    if owner_id is None:
        raise ValueError("No valid owner found for escalation")

    return owner_id


async def check_and_escalate_milestone_risk(
    db: AsyncSession,
    milestone_id: UUID,
) -> list[Escalation]:
    """
    Check milestone for risk factors:
    - Past due date + not completed
    - Tasks blocked
    - Create/update escalation if threshold met
    """
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    milestone = result.scalar_one_or_none()
    if not milestone:
        return []

    risk_factors: dict[str, object] = {}
    escalation_level = None

    # Check if milestone is overdue and not completed
    if (
        milestone.due_date
        and milestone.due_date < datetime.now(UTC).date()
        and milestone.status != "completed"
    ):
        days_overdue = (datetime.now(UTC).date() - milestone.due_date).days
        risk_factors["overdue_days"] = days_overdue
        escalation_level = EscalationLevel.milestone

    # Check for blocked tasks
    result = await db.execute(
        select(func.count(Task.id))
        .where(Task.milestone_id == milestone_id)
        .where(Task.status == "blocked")
    )
    blocked_count: int = result.scalar_one() or 0  # type: ignore[assignment]
    if blocked_count > 0:
        risk_factors["blocked_tasks"] = blocked_count
        escalation_level = EscalationLevel.milestone

    # Check for overdue tasks
    result = await db.execute(
        select(func.count(Task.id))
        .where(Task.milestone_id == milestone_id)
        .where(Task.due_date < datetime.now(UTC).date())
        .where(Task.status != "done")
    )
    overdue_count: int = result.scalar_one() or 0  # type: ignore[assignment]
    if overdue_count > 0:
        risk_factors["overdue_tasks"] = overdue_count
        escalation_level = EscalationLevel.milestone

    if not risk_factors or not escalation_level:
        return []

    # Check if escalation already exists
    esc_result = await db.execute(
        select(Escalation).where(
            Escalation.entity_type == "milestone",
            Escalation.entity_id == str(milestone_id),
            Escalation.status.in_(
                [EscalationStatus.open.value, EscalationStatus.acknowledged.value]
            ),
        )
    )
    existing = esc_result.scalar_one_or_none()

    if existing is not None:
        # Update existing escalation with new risk factors
        existing.risk_factors = risk_factors
        existing.escalation_chain = existing.escalation_chain or []
        existing.escalation_chain.append(
            {
                "action": "risk_updated",
                "at": datetime.now(UTC).isoformat(),
                "risk_factors": risk_factors,
            }
        )
        await db.commit()
        await db.refresh(existing)
        return [existing]

    # Create new escalation - get system user
    system_user_result = await db.execute(
        select(User).where(User.email == "system@amg.portal").limit(1)
    )
    system_user = system_user_result.scalar_one_or_none()

    # Fallback to first user if no system user
    if system_user is None:
        user_result = await db.execute(select(User).limit(1))
        system_user = user_result.scalar_one()
        if system_user is None:
            raise ValueError("No users found in database")

    escalation = await create_escalation(
        db=db,
        entity_type="milestone",
        entity_id=str(milestone_id),
        level=escalation_level,
        triggered_by=system_user,
        title=f"Milestone at risk: {milestone.title}",
        description=f"Milestone has the following risk factors: {', '.join(risk_factors.keys())}",
        risk_factors=risk_factors,
        program_id=milestone.program_id,
    )

    # Dispatch milestone_alert template notification for at-risk milestone
    try:
        from app.services.auto_dispatch_service import on_milestone_alert

        await on_milestone_alert(db, milestone, risk_factors)
    except Exception:
        logger.exception(
            "Failed to dispatch milestone_alert for milestone %s",
            milestone_id,
        )

    return [escalation]


async def update_escalation_status(
    db: AsyncSession,
    escalation_id: UUID,
    new_status: EscalationStatus,
    user: User,
    notes: str | None = None,
) -> Escalation:
    """Update status, update timestamps, send notifications."""
    result = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    escalation = result.scalar_one_or_none()
    if not escalation:
        raise ValueError(f"Escalation {escalation_id} not found")

    escalation.status = new_status.value

    # Update timestamps based on status
    now = datetime.now(UTC)
    if new_status == EscalationStatus.acknowledged and not escalation.acknowledged_at:
        escalation.acknowledged_at = now
    elif new_status == EscalationStatus.resolved and not escalation.resolved_at:
        escalation.resolved_at = now
    elif new_status == EscalationStatus.closed and not escalation.closed_at:
        escalation.closed_at = now

    if notes:
        escalation.resolution_notes = notes

    # Update escalation chain
    escalation.escalation_chain = escalation.escalation_chain or []
    escalation.escalation_chain.append(
        {
            "action": "status_change",
            "from": escalation.status,
            "to": new_status.value,
            "at": now.isoformat(),
            "by": user.email,
            "notes": notes,
        }
    )

    await db.commit()
    await db.refresh(escalation)

    logger.info(f"Escalation {escalation_id} updated to {new_status.value} by {user.email}")
    return escalation


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

    # Count total
    count_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = count_result.scalar_one()

    q = q.order_by(Escalation.triggered_at.desc()).offset(skip).limit(limit)

    result = await db.execute(q)
    escalations = result.scalars().all()

    # Build response with owner info
    escalation_data = []
    for esc in escalations:
        # Get owner info
        owner_result = await db.execute(select(User).where(User.id == esc.owner_id))
        owner = owner_result.scalar_one_or_none()

        # Get triggerer info
        triggerer_result = await db.execute(select(User).where(User.id == esc.triggered_by))
        triggerer = triggerer_result.scalar_one_or_none()

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
        }
        escalation_data.append(esc_dict)

    return escalation_data, total


def _next_level(current: EscalationLevel) -> EscalationLevel | None:
    """Return the next level in the promotion hierarchy, or ``None`` at the top."""
    try:
        idx = _PROMOTION_ORDER.index(current)
    except ValueError:
        return None
    if idx + 1 >= len(_PROMOTION_ORDER):
        return None
    return _PROMOTION_ORDER[idx + 1]


def _level_entry_time(escalation: Escalation) -> datetime:
    """Determine when the escalation entered its current level.

    Walks *escalation_chain* backwards to find the most recent ``level_promotion``
    entry.  Falls back to *triggered_at* for escalations that have never been
    promoted.
    """
    chain: list[dict[str, object]] = escalation.escalation_chain or []
    for entry in reversed(chain):
        if entry.get("action") == "level_promotion":
            promoted_at = entry.get("promoted_at")
            if isinstance(promoted_at, str):
                return datetime.fromisoformat(promoted_at)
    # Never been promoted — use the original trigger time.
    return escalation.triggered_at


def _sla_breached(escalation: Escalation, now: datetime) -> bool:
    """Return ``True`` if the escalation has exceeded its SLA for the current level."""
    current_level = EscalationLevel(escalation.level)
    sla_hours = _LEVEL_SLA_HOURS.get(current_level)
    if sla_hours is None:
        return False  # terminal level (client_impact)

    entered_at = _level_entry_time(escalation)
    deadline = entered_at + timedelta(hours=sla_hours)
    return now >= deadline


async def _promote_escalation(
    db: AsyncSession,
    escalation: Escalation,
    from_level: EscalationLevel,
    to_level: EscalationLevel,
    now: datetime,
) -> None:
    """Promote an escalation to the next level, re-assign owner, and notify."""
    from app.schemas.notification import CreateNotificationRequest
    from app.services.notification_service import notification_service

    # Determine new owner for the promoted level
    new_owner_id = await determine_escalation_owner(
        db, to_level, escalation.entity_type, escalation.entity_id
    )

    old_owner_id = escalation.owner_id

    # Update the escalation record
    escalation.level = to_level.value
    escalation.owner_id = new_owner_id
    # Reset status to open so the new owner must acknowledge
    escalation.status = EscalationStatus.open.value

    chain: list[dict[str, object]] = escalation.escalation_chain or []
    chain.append(
        {
            "action": "level_promotion",
            "from_level": from_level.value,
            "to_level": to_level.value,
            "promoted_at": now.isoformat(),
            "reason": "SLA breach",
            "previous_owner_id": str(old_owner_id),
            "new_owner_id": str(new_owner_id),
        }
    )
    escalation.escalation_chain = chain

    await db.flush()

    # Determine role label for notification context
    if to_level == EscalationLevel.client_impact:
        role_label = "Managing Director"
    elif to_level == EscalationLevel.program:
        role_label = "Relationship Manager"
    else:
        role_label = "Coordinator"

    # Create high-priority notification for the new owner
    await notification_service.create_notification(
        db,
        CreateNotificationRequest(
            user_id=new_owner_id,
            notification_type="system",
            title=f"Escalation promoted to {to_level.value}: {escalation.title}",
            body=(
                f"Escalation #{str(escalation.id)[:8]} has been automatically "
                f"promoted from {from_level.value} to {to_level.value} due to SLA breach. "
                f"As {role_label}, your immediate attention is required."
            ),
            priority="urgent",
            entity_type="escalation",
            entity_id=escalation.id,
            action_url=f"/escalations/{escalation.id}",
            action_label="View Escalation",
        ),
    )

    logger.info(
        "Escalation %s promoted: %s → %s (new owner %s)",
        escalation.id,
        from_level.value,
        to_level.value,
        new_owner_id,
    )


async def check_escalation_promotions(db: AsyncSession) -> list[Escalation]:
    """Check all open/acknowledged escalations and promote those that have breached SLA.

    Called periodically by the scheduler.  Returns the list of escalations that
    were promoted during this run.
    """
    now = datetime.now(UTC)

    # Fetch non-terminal escalations that are still actionable.
    # client_impact is the terminal level — nothing to promote.
    result = await db.execute(
        select(Escalation).where(
            Escalation.status.in_(
                [
                    EscalationStatus.open.value,
                    EscalationStatus.acknowledged.value,
                    EscalationStatus.investigating.value,
                ]
            ),
            Escalation.level != EscalationLevel.client_impact.value,
        )
    )
    escalations = list(result.scalars().all())

    promoted: list[Escalation] = []

    for esc in escalations:
        if not _sla_breached(esc, now):
            continue

        current_level = EscalationLevel(esc.level)
        target_level = _next_level(current_level)
        if target_level is None:
            continue

        try:
            await _promote_escalation(db, esc, current_level, target_level, now)
            promoted.append(esc)
        except Exception:
            logger.exception("Failed to promote escalation %s", esc.id)

    if promoted:
        await db.commit()

    logger.info(
        "Escalation promotion check complete — %d of %d escalations promoted",
        len(promoted),
        len(escalations),
    )
    return promoted
