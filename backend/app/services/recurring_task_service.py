"""Service layer for recurring task template processing."""

import logging
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import TaskStatus
from app.models.recurring_task import RecurringTaskTemplate
from app.models.task import Task

logger = logging.getLogger(__name__)


def compute_next_due(rrule_str: str, after: date) -> date | None:
    """Parse RRULE and compute the next occurrence after `after`."""
    from dateutil.rrule import rrulestr  # type: ignore[import-untyped]

    dtstart = datetime(after.year, after.month, after.day, tzinfo=UTC)
    rule = rrulestr(rrule_str, dtstart=dtstart)
    after_dt = datetime(after.year, after.month, after.day, tzinfo=UTC)
    nxt = rule.after(after_dt)
    return nxt.date() if nxt else None


async def initialize_next_due(db: AsyncSession, template: RecurringTaskTemplate) -> None:
    """Set next_due_date on a newly created template."""
    today = datetime.now(UTC).date()
    template.next_due_date = compute_next_due(template.rrule, today)
    await db.commit()


def _expand_title(template_str: str, today: date) -> str:
    """Replace {year}, {quarter}, {month}, {date} placeholders."""
    quarter = (today.month - 1) // 3 + 1
    return (
        template_str.replace("{year}", str(today.year))
        .replace("{quarter}", str(quarter))
        .replace("{month}", today.strftime("%B"))
        .replace("{date}", today.strftime("%Y-%m-%d"))
    )


async def generate_task_from_template(
    db: AsyncSession, template: RecurringTaskTemplate
) -> Task | None:
    """Create a Task from a recurring template.

    Returns the created task, or None if milestone_id is not set.
    """
    if not template.milestone_id:
        logger.warning(
            "Template %s has no milestone_id — skipping task generation", template.id
        )
        return None

    today = datetime.now(UTC).date()
    title = _expand_title(template.task_title_template, today)

    max_pos_result = await db.execute(
        select(func.max(Task.position)).where(Task.status == TaskStatus.todo)
    )
    max_pos = max_pos_result.scalar() or 0

    task = Task(
        milestone_id=template.milestone_id,
        title=title,
        description=template.task_description,
        status=TaskStatus.todo,
        priority=template.priority,
        due_date=template.next_due_date,
        assigned_to=template.assignee_id,
        position=max_pos + 1,
        recurring_template_id=template.id,
    )
    db.add(task)

    template.last_triggered_at = datetime.now(UTC)
    template.next_due_date = compute_next_due(template.rrule, today)

    await db.commit()
    await db.refresh(task)

    # Send notification to assignee (if set) and template creator
    try:
        from app.schemas.notification import CreateNotificationRequest
        from app.services.notification_service import notification_service

        async with db.begin_nested():
            notif_user_ids: list[Any] = []
            if template.assignee_id:
                notif_user_ids.append(template.assignee_id)
            if template.created_by and template.created_by not in notif_user_ids:
                notif_user_ids.append(template.created_by)

            for user_id in notif_user_ids:
                await notification_service.create_notification(
                    db,
                    CreateNotificationRequest(
                        user_id=user_id,
                        notification_type="system",
                        title=f"Recurring task created: {title}",
                        body=(
                            f"A recurring task was automatically generated from template "
                            f"'{template.name}': {title}."
                        ),
                        priority="medium",
                        entity_type="task",
                        entity_id=task.id,
                    ),
                )
    except Exception:
        logger.exception(
            "Failed to send notification for auto-generated task %s", task.id
        )

    return task


async def process_due_templates(db: AsyncSession) -> int:
    """Find all active templates with next_due_date <= today and generate tasks.

    Returns the count of tasks successfully created.
    """
    today = datetime.now(UTC).date()
    result = await db.execute(
        select(RecurringTaskTemplate).where(
            RecurringTaskTemplate.is_active.is_(True),
            RecurringTaskTemplate.next_due_date <= today,
            RecurringTaskTemplate.next_due_date.isnot(None),
        )
    )
    templates = result.scalars().all()
    count = 0
    for template in templates:
        try:
            task = await generate_task_from_template(db, template)
            if task:
                count += 1
        except Exception:
            logger.exception("Failed to generate task for template %s", template.id)
    return count
