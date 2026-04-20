"""Milestone risk detection and auto-escalation."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EscalationLevel, EscalationStatus
from app.models.escalation import Escalation
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.task import Task
from app.models.user import User

from ._workflow import create_escalation

logger = logging.getLogger(__name__)


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
        description=(f"Milestone has the following risk factors: {', '.join(risk_factors.keys())}"),
        risk_factors=risk_factors,
        program_id=milestone.program_id,
    )

    # For overdue milestones: notify the program RM and coordinator
    if is_overdue:
        program_result = await db.execute(select(Program).where(Program.id == milestone.program_id))
        program = program_result.scalar_one_or_none()
        if program:
            await _notify_overdue_milestone(db, milestone, program, escalation)

    return [escalation]
