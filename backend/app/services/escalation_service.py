"""Escalation business logic — risk detection, owner determination, status workflows."""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EscalationLevel, EscalationStatus
from app.models.escalation import Escalation
from app.models.escalation_rule import EscalationRule
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.task import Task
from app.models.user import User

logger = logging.getLogger(__name__)

# Hours within which the assigned owner must respond after the escalation is triggered
RESPONSE_DEADLINES_HOURS: dict[str, int] = {
    "task": 1,
    "milestone": 1,
    "program": 2,
    "client_impact": 0,  # Immediate — no grace period
}

# Auto-progression: level → (next_level, hours_before_auto_progress)
ESCALATION_PROGRESSION: dict[str, tuple[str, int]] = {
    "task": ("milestone", 4),
    "milestone": ("program", 4),
    "program": ("client_impact", 8),
}


def calculate_response_deadline(level: str, triggered_at: datetime) -> datetime:
    """Return the datetime by which the owner must respond."""
    hours = RESPONSE_DEADLINES_HOURS.get(level, 1)
    return triggered_at + timedelta(hours=hours)


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

    now = datetime.now(UTC)
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
        response_deadline=calculate_response_deadline(level.value, now),
        escalation_chain=[
            {
                "action": "triggered",
                "at": now.isoformat(),
                "by": triggered_by.email,
            }
        ],
    )
    db.add(escalation)
    await db.commit()
    await db.refresh(escalation)

    logger.info(
        "Escalation created: %s - %s for %s:%s",
        escalation.id,
        level.value,
        entity_type,
        entity_id,
    )

    # Broadcast real-time update via WebSocket to owner and triggerer
    try:
        from app.api.ws_connection import connection_manager

        ws_payload: dict[str, object] = {
            "type": "escalation",
            "action": "created",
            "data": {
                "id": str(escalation.id),
                "level": escalation.level,
                "status": escalation.status,
                "title": escalation.title,
                "entity_type": escalation.entity_type,
                "entity_id": escalation.entity_id,
                "program_id": str(escalation.program_id) if escalation.program_id else None,
            },
        }
        await connection_manager.send_personal(ws_payload, escalation.owner_id)
        if triggered_by.id != escalation.owner_id:
            await connection_manager.send_personal(ws_payload, triggered_by.id)
    except Exception:
        logger.exception("Failed to broadcast escalation creation for %s", escalation.id)

    return escalation


async def determine_escalation_owner(
    db: AsyncSession,
    level: EscalationLevel,
    entity_type: str,
    entity_id: str,
) -> UUID:
    """
    Determine owner based on escalation hierarchy:
    - task-level      → Coordinator (task.assigned_to or program creator)
    - milestone-level → RM (client's relationship manager)
    - program-level   → MD (managing director)
    - client_impact   → MD (managing director)
    """
    owner_id: UUID | None = None

    if level in (EscalationLevel.program, EscalationLevel.client_impact):
        # Managing Director owns program-level and client-impact escalations
        result = await db.execute(
            select(User.id)
            .where(User.role == "managing_director", User.status == "active")
            .order_by(User.created_at)
            .limit(1)
        )
        owner_id = result.scalar_one_or_none()

    elif level == EscalationLevel.milestone:
        # RM owns milestone-level escalations.
        # Resolve via: milestone → program → client → rm_id
        if entity_type == "milestone":
            from app.models.client import Client

            result = await db.execute(
                select(Client.rm_id)
                .join(Program, Program.client_id == Client.id)
                .join(Milestone, Milestone.program_id == Program.id)
                .where(Milestone.id == entity_id)
            )
            owner_id = result.scalar_one_or_none()

        if not owner_id:
            # Fallback to any active RM
            result = await db.execute(
                select(User.id)
                .where(User.role == "relationship_manager", User.status == "active")
                .order_by(User.created_at)
                .limit(1)
            )
            owner_id = result.scalar_one_or_none()

    elif level == EscalationLevel.task:
        # Coordinator owns task-level escalations: task assignee first, then program creator
        if entity_type == "task":
            result = await db.execute(select(Task.assigned_to).where(Task.id == entity_id))
            owner_id = result.scalar_one_or_none()

            if not owner_id:
                # Fallback to program creator (coordinator role)
                result = await db.execute(
                    select(Program.created_by)
                    .join(Milestone, Milestone.program_id == Program.id)
                    .join(Task, Task.milestone_id == Milestone.id)
                    .where(Task.id == entity_id)
                )
                owner_id = result.scalar_one_or_none()

        if not owner_id:
            # Fallback to any active coordinator
            result = await db.execute(
                select(User.id)
                .where(User.role == "coordinator", User.status == "active")
                .order_by(User.created_at)
                .limit(1)
            )
            owner_id = result.scalar_one_or_none()

    # Ultimate fallback: first managing director (active or any)
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


async def _notify_overdue_milestone(
    db: AsyncSession,
    milestone: Milestone,
    program: Program,
    escalation: Escalation,
) -> None:
    """Notify the program RM and coordinator about an overdue milestone."""
    from app.models.client import Client
    from app.schemas.notification import CreateNotificationRequest
    from app.services.notification_service import notification_service

    client_result = await db.execute(select(Client).where(Client.id == program.client_id))
    client = client_result.scalar_one_or_none()

    recipient_ids: set[UUID] = set()
    if client and client.rm_id:
        recipient_ids.add(client.rm_id)
    if program.created_by:
        recipient_ids.add(program.created_by)

    rf = escalation.risk_factors or {}
    days_until_due = int(rf.get("days_until_due", 0))  # type: ignore[call-overload]
    days_overdue = abs(days_until_due)

    for user_id in recipient_ids:
        try:
            await notification_service.create_notification(
                db,
                CreateNotificationRequest(
                    user_id=user_id,
                    notification_type="milestone_update",
                    title=f"Overdue Milestone: {milestone.title}",
                    body=(
                        f"Milestone '{milestone.title}' in program '{program.title}' "
                        f"is {days_overdue} day(s) overdue. "
                        f"An escalation has been raised (ref: {escalation.id})."
                    ),
                    priority="urgent",
                ),
            )
        except Exception:
            logger.exception(
                "Failed to notify user %s about overdue milestone %s",
                user_id,
                milestone.id,
            )


async def _compute_milestone_risk_factors(
    db: AsyncSession,
    milestone: Milestone,
) -> tuple[dict[str, object], EscalationLevel | None]:
    """
    Analyse a milestone and return (risk_factors, escalation_level).

    Due-date rules:
    - overdue (past due, not completed)    → EscalationLevel.program  (MD)
    - approaching (≤3 days, not completed) → EscalationLevel.milestone (RM)
    - blocked/overdue tasks                → EscalationLevel.milestone (fallback)

    risk_factors always contains days_until_due, overdue, completion_percentage
    when a due_date is present.
    """
    today = datetime.now(UTC).date()
    milestone_id = milestone.id
    risk_factors: dict[str, object] = {}
    escalation_level: EscalationLevel | None = None

    # Task completion percentage
    total_result = await db.execute(
        select(func.count(Task.id)).where(Task.milestone_id == milestone_id)
    )
    total_tasks: int = total_result.scalar_one() or 0

    done_result = await db.execute(
        select(func.count(Task.id))
        .where(Task.milestone_id == milestone_id)
        .where(Task.status == "done")
    )
    done_tasks: int = done_result.scalar_one() or 0
    completion_pct = round(done_tasks / total_tasks * 100, 1) if total_tasks > 0 else 0.0

    # Due-date risk
    if milestone.due_date and milestone.status != "completed":
        days_until_due = (milestone.due_date - today).days  # negative when overdue
        risk_factors["days_until_due"] = days_until_due
        risk_factors["overdue"] = days_until_due < 0
        risk_factors["completion_percentage"] = completion_pct
        if days_until_due < 0:
            escalation_level = EscalationLevel.program
        elif days_until_due <= 3:
            escalation_level = EscalationLevel.milestone

    # Blocked tasks
    blocked_result = await db.execute(
        select(func.count(Task.id))
        .where(Task.milestone_id == milestone_id)
        .where(Task.status == "blocked")
    )
    blocked_count: int = blocked_result.scalar_one() or 0
    if blocked_count > 0:
        risk_factors["blocked_tasks"] = blocked_count
        escalation_level = escalation_level or EscalationLevel.milestone

    # Overdue tasks
    overdue_tasks_result = await db.execute(
        select(func.count(Task.id))
        .where(Task.milestone_id == milestone_id)
        .where(Task.due_date < today)
        .where(Task.status != "done")
    )
    overdue_task_count: int = overdue_tasks_result.scalar_one() or 0
    if overdue_task_count > 0:
        risk_factors["overdue_tasks"] = overdue_task_count
        escalation_level = escalation_level or EscalationLevel.milestone

    return risk_factors, escalation_level


async def check_and_escalate_milestone_risk(
    db: AsyncSession,
    milestone_id: UUID,
) -> list[Escalation]:
    """Check milestone for risk and create/update an Escalation record if needed.

    Creates no duplicate when an open/acknowledged escalation already exists —
    instead the existing record is updated with refreshed risk_factors and its
    level is upgraded (milestone → program) if the milestone has become overdue.
    """
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    milestone = result.scalar_one_or_none()
    if not milestone:
        return []

    risk_factors, escalation_level = await _compute_milestone_risk_factors(db, milestone)

    if not risk_factors or not escalation_level:
        return []

    # Deduplication: check for an active escalation on this milestone
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
        existing.risk_factors = risk_factors
        # Upgrade from milestone → program level if now overdue
        if (
            escalation_level == EscalationLevel.program
            and existing.level != EscalationLevel.program.value
        ):
            existing.level = EscalationLevel.program
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

    # Resolve system user to attribute the auto-triggered escalation
    system_user_result = await db.execute(
        select(User).where(User.email == "system@amg.portal").limit(1)
    )
    system_user = system_user_result.scalar_one_or_none()
    if system_user is None:
        fallback_result = await db.execute(select(User).limit(1))
        system_user = fallback_result.scalar_one_or_none()
        if system_user is None:
            raise ValueError("No users found in database")

    is_overdue = bool(risk_factors.get("overdue", False))
    level_label = "overdue" if is_overdue else "at risk"

    escalation = await create_escalation(
        db=db,
        entity_type="milestone",
        entity_id=str(milestone_id),
        level=escalation_level,
        triggered_by=system_user,
        title=f"Milestone {level_label}: {milestone.title}",
        description=(
            f"Milestone has the following risk factors: {', '.join(risk_factors.keys())}"
        ),
        risk_factors=risk_factors,
        program_id=milestone.program_id,
    )

    # For overdue milestones: notify the program RM and coordinator
    if is_overdue:
        program_result = await db.execute(
            select(Program).where(Program.id == milestone.program_id)
        )
        program = program_result.scalar_one_or_none()
        if program:
            await _notify_overdue_milestone(db, milestone, program, escalation)

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

    escalation.status = new_status

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

    logger.info("Escalation %s updated to %s by %s", escalation_id, new_status.value, user.email)

    # Broadcast real-time update via WebSocket to owner and triggerer
    try:
        from app.api.ws_connection import connection_manager

        ws_payload: dict[str, object] = {
            "type": "escalation",
            "action": "updated",
            "data": {
                "id": str(escalation.id),
                "level": escalation.level,
                "status": escalation.status,
                "title": escalation.title,
                "entity_type": escalation.entity_type,
                "entity_id": escalation.entity_id,
            },
        }
        await connection_manager.send_personal(ws_payload, escalation.owner_id)
        if escalation.triggered_by and escalation.triggered_by != escalation.owner_id:
            await connection_manager.send_personal(ws_payload, escalation.triggered_by)
    except Exception:
        logger.exception("Failed to broadcast escalation update for %s", escalation_id)

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


async def evaluate_auto_triggers(db: AsyncSession) -> list[Escalation]:
    """Scan SLA breaches, overdue milestones, and overdue tasks against active rules.

    For each matching rule where no open escalation already exists for the entity,
    auto-create an escalation.
    """
    logger.info("Evaluating auto-trigger escalation rules")
    created: list[Escalation] = []

    # Load active rules
    result = await db.execute(
        select(EscalationRule).where(EscalationRule.is_active.is_(True))
    )
    rules = list(result.scalars().all())
    if not rules:
        logger.info("No active escalation rules found")
        return created

    # Resolve system user
    system_user_result = await db.execute(
        select(User).where(User.email == "system@amg.portal").limit(1)
    )
    system_user = system_user_result.scalar_one_or_none()
    if system_user is None:
        fallback_result = await db.execute(select(User).limit(1))
        system_user = fallback_result.scalar_one_or_none()
        if system_user is None:
            logger.error("No users found — cannot evaluate triggers")
            return created

    today = datetime.now(UTC).date()

    for rule in rules:
        try:
            conditions = rule.trigger_conditions or {}

            if rule.trigger_type == "sla_breach":
                created.extend(
                    await _evaluate_sla_breach_rule(db, rule, conditions, system_user)
                )

            elif rule.trigger_type == "milestone_overdue":
                created.extend(
                    await _evaluate_milestone_overdue_rule(
                        db, rule, conditions, system_user, today
                    )
                )

            elif rule.trigger_type == "task_overdue":
                created.extend(
                    await _evaluate_task_overdue_rule(
                        db, rule, conditions, system_user, today
                    )
                )

        except Exception:
            logger.exception("Error evaluating rule %s (%s)", rule.id, rule.name)

    logger.info("Auto-trigger evaluation complete — %d escalations created", len(created))
    return created


async def _load_open_escalation_set(
    db: AsyncSession,
    entity_ids: list[str],
) -> set[tuple[str, str]]:
    """Batch-load open/acknowledged/investigating escalations for a list of entity IDs.

    Returns a set of (entity_type, entity_id) tuples for fast membership testing.
    """
    if not entity_ids:
        return set()
    result = await db.execute(
        select(Escalation.entity_type, Escalation.entity_id).where(
            Escalation.entity_id.in_(entity_ids),
            Escalation.status.in_(
                [
                    EscalationStatus.open.value,
                    EscalationStatus.acknowledged.value,
                    EscalationStatus.investigating.value,
                ]
            ),
        )
    )
    return {(row.entity_type, row.entity_id) for row in result.all()}


async def _evaluate_sla_breach_rule(
    db: AsyncSession,
    rule: EscalationRule,
    conditions: dict[str, object],
    system_user: User,
) -> list[Escalation]:
    """Check SLA breaches against an sla_breach rule."""
    from app.models.sla_tracker import SLATracker

    created: list[Escalation] = []
    sla_hours_exceeded = int(str(conditions.get("sla_hours_exceeded", 0)))

    # Find breached SLA trackers
    result = await db.execute(
        select(SLATracker).where(SLATracker.breach_status == "breached")
    )
    breached_trackers = list(result.scalars().all())

    if not breached_trackers:
        return created

    # Batch-load open escalations for all candidate entity IDs in one query
    all_entity_ids = [t.entity_id for t in breached_trackers]
    open_set = await _load_open_escalation_set(db, all_entity_ids)

    now = datetime.now(UTC)
    for tracker in breached_trackers:
        # Check if hours exceeded threshold
        if sla_hours_exceeded > 0:
            elapsed_hours = (now - tracker.started_at).total_seconds() / 3600
            if elapsed_hours < sla_hours_exceeded:
                continue

        # Deduplication via in-memory set
        if (tracker.entity_type, tracker.entity_id) in open_set:
            continue

        esc = await create_escalation(
            db=db,
            entity_type=tracker.entity_type,
            entity_id=tracker.entity_id,
            level=EscalationLevel(rule.escalation_level),
            triggered_by=system_user,
            title=f"SLA breach auto-escalation: {tracker.entity_type} {tracker.entity_id[:8]}",
            description=(
                f"Auto-triggered by rule '{rule.name}'. "
                f"SLA of {tracker.sla_hours}h breached for "
                f"{tracker.communication_type} on {tracker.entity_type}."
            ),
            risk_factors={
                "trigger_rule_id": str(rule.id),
                "trigger_type": "sla_breach",
                "sla_hours": tracker.sla_hours,
                "breach_status": tracker.breach_status,
            },
        )
        created.append(esc)
        # Keep the set consistent so subsequent items in this batch don't double-create
        open_set.add((tracker.entity_type, tracker.entity_id))

    return created


async def _evaluate_milestone_overdue_rule(
    db: AsyncSession,
    rule: EscalationRule,
    conditions: dict[str, object],
    system_user: User,
    today: date,
) -> list[Escalation]:
    """Check overdue milestones against a milestone_overdue rule."""
    created: list[Escalation] = []
    days_overdue_threshold = int(str(conditions.get("days_overdue", 1)))

    result = await db.execute(
        select(Milestone).where(
            Milestone.status.notin_(["completed", "cancelled"]),
            Milestone.due_date.isnot(None),
            Milestone.due_date < today,
        )
    )
    milestones = list(result.scalars().all())

    if not milestones:
        return created

    # Batch-load open escalations for all candidate milestone IDs in one query
    all_entity_ids = [str(m.id) for m in milestones]
    open_set = await _load_open_escalation_set(db, all_entity_ids)

    for milestone in milestones:
        if milestone.due_date is None:
            continue
        days_over = (datetime.now(UTC).date() - milestone.due_date).days
        if days_over < days_overdue_threshold:
            continue

        if ("milestone", str(milestone.id)) in open_set:
            continue

        esc = await create_escalation(
            db=db,
            entity_type="milestone",
            entity_id=str(milestone.id),
            level=EscalationLevel(rule.escalation_level),
            triggered_by=system_user,
            title=f"Overdue milestone auto-escalation: {milestone.title}",
            description=(
                f"Auto-triggered by rule '{rule.name}'. "
                f"Milestone '{milestone.title}' is {days_over} day(s) overdue."
            ),
            risk_factors={
                "trigger_rule_id": str(rule.id),
                "trigger_type": "milestone_overdue",
                "days_overdue": days_over,
            },
            program_id=milestone.program_id,
        )
        created.append(esc)
        open_set.add(("milestone", str(milestone.id)))

    return created


async def _evaluate_task_overdue_rule(
    db: AsyncSession,
    rule: EscalationRule,
    conditions: dict[str, object],
    system_user: User,
    today: date,
) -> list[Escalation]:
    """Check overdue tasks against a task_overdue rule."""
    created: list[Escalation] = []
    days_overdue_threshold = int(str(conditions.get("days_overdue", 1)))

    result = await db.execute(
        select(Task).where(
            Task.status.notin_(["done", "cancelled"]),
            Task.due_date.isnot(None),
            Task.due_date < today,
        )
    )
    tasks = list(result.scalars().all())

    if not tasks:
        return created

    # Batch-load open escalations for all candidate task IDs in one query
    all_entity_ids = [str(t.id) for t in tasks]
    open_set = await _load_open_escalation_set(db, all_entity_ids)

    for task in tasks:
        if task.due_date is None:
            continue
        days_over = (datetime.now(UTC).date() - task.due_date).days
        if days_over < days_overdue_threshold:
            continue

        if ("task", str(task.id)) in open_set:
            continue

        esc = await create_escalation(
            db=db,
            entity_type="task",
            entity_id=str(task.id),
            level=EscalationLevel(rule.escalation_level),
            triggered_by=system_user,
            title=f"Overdue task auto-escalation: {task.title}",
            description=(
                f"Auto-triggered by rule '{rule.name}'. "
                f"Task '{task.title}' is {days_over} day(s) overdue."
            ),
            risk_factors={
                "trigger_rule_id": str(rule.id),
                "trigger_type": "task_overdue",
                "days_overdue": days_over,
            },
        )
        created.append(esc)
        open_set.add(("task", str(task.id)))

    return created


async def _has_open_escalation(
    db: AsyncSession, entity_type: str, entity_id: str
) -> bool:
    """Check if an open/acknowledged escalation already exists for an entity."""
    result = await db.execute(
        select(func.count(Escalation.id)).where(
            Escalation.entity_type == entity_type,
            Escalation.entity_id == entity_id,
            Escalation.status.in_(
                [
                    EscalationStatus.open.value,
                    EscalationStatus.acknowledged.value,
                    EscalationStatus.investigating.value,
                ]
            ),
        )
    )
    count = result.scalar_one()
    return count > 0


LEVEL_PROGRESSION = [
    EscalationLevel.task,
    EscalationLevel.milestone,
    EscalationLevel.program,
    EscalationLevel.client_impact,
]


async def progress_escalation_chain(
    db: AsyncSession,
    escalation_id: UUID,
    user: User,
    notes: str | None = None,
) -> Escalation:
    """Advance an escalation to the next level in the chain.

    E.g. task → milestone → program → client_impact.
    Appends an entry to the escalation_chain JSONB with timestamps and level transition info.
    """
    result = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    escalation = result.scalar_one_or_none()
    if not escalation:
        raise ValueError(f"Escalation {escalation_id} not found")

    if escalation.status in (EscalationStatus.resolved.value, EscalationStatus.closed.value):
        raise ValueError("Cannot progress a resolved or closed escalation")

    current_level = EscalationLevel(escalation.level)

    # Find next level
    try:
        current_idx = LEVEL_PROGRESSION.index(current_level)
    except ValueError as err:
        raise ValueError(f"Unknown escalation level: {current_level}") from err

    if current_idx >= len(LEVEL_PROGRESSION) - 1:
        raise ValueError(
            f"Escalation is already at the highest level ({current_level.value})"
        )

    next_level = LEVEL_PROGRESSION[current_idx + 1]

    # Update escalation level
    from_level = escalation.level
    escalation.level = next_level

    # Re-determine owner for the new level
    new_owner_id = await determine_escalation_owner(
        db, next_level, escalation.entity_type, escalation.entity_id
    )
    escalation.owner_id = new_owner_id

    # Append to escalation chain
    now = datetime.now(UTC)
    escalation.escalation_chain = escalation.escalation_chain or []
    escalation.escalation_chain.append(
        {
            "action": "chain_progression",
            "from_level": from_level,
            "to_level": next_level.value,
            "at": now.isoformat(),
            "by": user.email,
            "notes": notes,
            "new_owner_id": str(new_owner_id),
        }
    )

    await db.commit()
    await db.refresh(escalation)

    logger.info(
        "Escalation %s progressed from %s to %s by %s",
        escalation_id,
        from_level,
        next_level.value,
        user.email,
    )

    # Broadcast real-time update via WebSocket
    try:
        from app.api.ws_connection import connection_manager

        ws_payload: dict[str, object] = {
            "type": "escalation",
            "action": "progressed",
            "data": {
                "id": str(escalation.id),
                "level": escalation.level,
                "status": escalation.status,
                "title": escalation.title,
                "from_level": from_level,
                "to_level": next_level.value,
            },
        }
        await connection_manager.send_personal(ws_payload, escalation.owner_id)
    except Exception:
        logger.exception("Failed to broadcast escalation progression for %s", escalation_id)

    return escalation


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


async def auto_progress_escalation(
    db: AsyncSession,
    escalation_id: UUID,
) -> Escalation | None:
    """Automatically progress an escalation to the next level if past deadline.

    Called by the scheduler job. Returns the updated escalation if progressed,
    or None if no progression was needed.
    """
    result = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    escalation = result.scalar_one_or_none()
    if not escalation:
        return None

    if escalation.status not in (
        EscalationStatus.open.value,
        EscalationStatus.acknowledged.value,
    ):
        return None

    next_level_info = ESCALATION_PROGRESSION.get(escalation.level)
    if not next_level_info:
        return None  # Already at highest level

    next_level_str, threshold_hours = next_level_info
    hours_elapsed = (datetime.now(UTC) - escalation.triggered_at).total_seconds() / 3600
    if hours_elapsed < threshold_hours:
        return None  # Not past threshold yet

    next_level = EscalationLevel(next_level_str)

    # Resolve owner for the new level
    system_user_result = await db.execute(
        select(User).where(User.email == "system@amg.portal").limit(1)
    )
    system_user = system_user_result.scalar_one_or_none()
    if system_user is None:
        fallback_result = await db.execute(select(User).limit(1))
        system_user = fallback_result.scalar_one_or_none()

    new_owner_id = await determine_escalation_owner(
        db, next_level, escalation.entity_type, escalation.entity_id
    )

    now = datetime.now(UTC)
    parent_id = escalation.id

    # Create child escalation at next level
    child = Escalation(
        level=next_level.value,
        status=EscalationStatus.open.value,
        title=escalation.title,
        description=escalation.description,
        entity_type=escalation.entity_type,
        entity_id=escalation.entity_id,
        owner_id=new_owner_id,
        triggered_by=escalation.triggered_by,
        risk_factors=escalation.risk_factors,
        program_id=escalation.program_id,
        client_id=escalation.client_id,
        parent_escalation_id=parent_id,
        response_deadline=calculate_response_deadline(next_level.value, now),
        escalation_chain=[
            {
                "action": "auto_progressed",
                "at": now.isoformat(),
                "from_level": escalation.level,
                "to_level": next_level.value,
                "parent_id": str(parent_id),
            }
        ],
    )
    db.add(child)

    # Update parent chain
    escalation.escalation_chain = escalation.escalation_chain or []
    escalation.escalation_chain.append(
        {
            "action": "auto_progressed",
            "at": now.isoformat(),
            "to_level": next_level.value,
            "by": system_user.email if system_user else "system",
        }
    )

    await db.commit()
    await db.refresh(child)

    logger.info(
        "Auto-progressed escalation %s from %s to %s (child: %s)",
        parent_id,
        escalation.level,
        next_level.value,
        child.id,
    )

    # Notify new owner via WebSocket
    try:
        from app.api.ws_connection import connection_manager

        ws_payload: dict[str, object] = {
            "type": "escalation",
            "action": "auto_progressed",
            "data": {
                "id": str(child.id),
                "level": child.level,
                "status": child.status,
                "title": child.title,
                "parent_id": str(parent_id),
            },
        }
        await connection_manager.send_personal(ws_payload, new_owner_id)
    except Exception:
        logger.exception("Failed to broadcast auto-progression for escalation %s", parent_id)

    return child


async def create_escalation_from_sla_breach(
    db: AsyncSession,
    sla_tracker: object,
) -> Escalation | None:
    """Create an escalation from an SLA tracker that just breached.

    Maps entity_type → escalation level and deduplicates against existing open
    escalations for the same entity.

    Returns the created Escalation or None if skipped (duplicate).
    """
    from app.models.sla_tracker import SLATracker

    tracker: SLATracker = sla_tracker  # type: ignore[assignment]

    # Map entity_type to escalation level
    level_map: dict[str, EscalationLevel] = {
        "task": EscalationLevel.task,
        "milestone": EscalationLevel.milestone,
        "program": EscalationLevel.program,
    }
    level = level_map.get(tracker.entity_type, EscalationLevel.task)

    # Deduplication
    existing = await _has_open_escalation(db, tracker.entity_type, tracker.entity_id)
    if existing:
        logger.info(
            "Skipping SLA breach escalation for %s:%s — open escalation already exists",
            tracker.entity_type,
            tracker.entity_id,
        )
        return None

    # Resolve system user
    system_user_result = await db.execute(
        select(User).where(User.email == "system@amg.portal").limit(1)
    )
    system_user = system_user_result.scalar_one_or_none()
    if system_user is None:
        fallback_result = await db.execute(select(User).limit(1))
        system_user = fallback_result.scalar_one_or_none()
        if system_user is None:
            logger.error("No users found — cannot create SLA breach escalation")
            return None

    esc = await create_escalation(
        db=db,
        entity_type=tracker.entity_type,
        entity_id=tracker.entity_id,
        level=level,
        triggered_by=system_user,
        title=(
            f"SLA Breach: {tracker.communication_type.replace('_', ' ').title()} "
            f"on {tracker.entity_type} {tracker.entity_id[:8]}"
        ),
        description=(
            f"Automatic escalation: the {tracker.sla_hours}h response SLA for a "
            f"{tracker.communication_type.replace('_', ' ')} has been breached."
        ),
        risk_factors={
            "trigger_type": "sla_breach",
            "sla_hours": tracker.sla_hours,
            "communication_type": tracker.communication_type,
            "breach_status": tracker.breach_status,
        },
    )

    logger.info(
        "Created SLA breach escalation %s for %s:%s",
        esc.id,
        tracker.entity_type,
        tracker.entity_id,
    )
    return esc


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
    for level in ("task", "milestone", "program", "client_impact"):
        count_result = await db.execute(
            select(func.count(Escalation.id)).where(
                Escalation.level == level,
                Escalation.status.in_(active_statuses),
            )
        )
        open_by_level[level] = count_result.scalar_one() or 0

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


async def reassign_escalation(
    db: AsyncSession,
    escalation_id: UUID,
    new_owner_id: UUID,
    user: User,
) -> Escalation:
    """Reassign an escalation to a new owner (MD only)."""
    result = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    escalation = result.scalar_one_or_none()
    if not escalation:
        raise ValueError(f"Escalation {escalation_id} not found")

    old_owner_id = escalation.owner_id
    escalation.owner_id = new_owner_id

    now = datetime.now(UTC)
    escalation.escalation_chain = escalation.escalation_chain or []
    escalation.escalation_chain.append(
        {
            "action": "reassigned",
            "at": now.isoformat(),
            "by": user.email,
            "from_owner_id": str(old_owner_id),
            "to_owner_id": str(new_owner_id),
        }
    )

    await db.commit()
    await db.refresh(escalation)

    logger.info(
        "Escalation %s reassigned from %s to %s by %s",
        escalation_id,
        old_owner_id,
        new_owner_id,
        user.email,
    )

    # Notify new owner via WebSocket
    try:
        from app.api.ws_connection import connection_manager

        ws_payload: dict[str, object] = {
            "type": "escalation",
            "action": "reassigned",
            "data": {
                "id": str(escalation.id),
                "level": escalation.level,
                "status": escalation.status,
                "title": escalation.title,
            },
        }
        await connection_manager.send_personal(ws_payload, new_owner_id)
    except Exception:
        logger.exception("Failed to broadcast escalation reassignment for %s", escalation_id)

    return escalation
