"""Auto-trigger evaluation: scan SLA, milestones, tasks against active rules."""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EscalationLevel
from app.models.escalation import Escalation
from app.models.escalation_rule import EscalationRule
from app.models.milestone import Milestone
from app.models.task import Task
from app.models.user import User

from ._helpers import _load_open_escalation_set
from ._workflow import create_escalation

logger = logging.getLogger(__name__)


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
