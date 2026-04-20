"""Task cascade service — propagates task status changes up to milestones and programs.

Rules
-----
* When **all** tasks in a milestone are ``done`` or ``cancelled``, the milestone
  is automatically set to ``completed``.
* When **any** task in a milestone is ``blocked``, the milestone is set to
  ``at_risk`` (unless it is already ``completed`` or ``cancelled``).
* When no task is blocked and the milestone is not fully done, it is kept at
  ``in_progress`` (if at least one task is active) or ``pending``.
* When a milestone auto-completes and every milestone in its program is now
  ``completed`` or ``cancelled``, the program RM and creator are notified to
  consider initiating program closure. The program itself is **not** auto-completed.
* **Reverse cascade**: Adding a new task to an already-completed milestone reverts
  it to ``in_progress``.
* After any milestone status change the program RAG status is recomputed and
  logged so dashboards stay current on the next load.
"""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import MilestoneStatus, NotificationType, TaskStatus
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.task import Task
from app.schemas.notification import CreateNotificationRequest
from app.services.notification_service import notification_service
from app.services.report_service import compute_rag_status

logger = logging.getLogger(__name__)

# Task statuses that count as "terminal" — they do not block completion
_TERMINAL_TASK_STATUSES = {TaskStatus.done, TaskStatus.cancelled}


def _derive_milestone_status(tasks: list[Task]) -> str:
    """Return the milestone status that best reflects the current task set.

    The returned value is always a ``MilestoneStatus`` string so it can be
    written directly to ``Milestone.status``.
    """
    if not tasks:
        return MilestoneStatus.pending

    statuses = {t.status for t in tasks}

    # All tasks are in a terminal state → milestone is done
    if statuses <= _TERMINAL_TASK_STATUSES:
        return MilestoneStatus.completed

    # Any blocked task → milestone is at risk
    if TaskStatus.blocked in statuses:
        return MilestoneStatus.at_risk

    # At least one task is actively being worked on
    if TaskStatus.in_progress in statuses:
        return MilestoneStatus.in_progress

    # Only todo / cancelled tasks remain (e.g. work not yet started)
    return MilestoneStatus.pending


async def _collect_notification_recipients(
    db: AsyncSession,
    program: Program,
) -> list[uuid.UUID]:
    """Return de-duplicated list of user IDs to notify for a program event."""
    from app.models.client import Client

    recipients: list[uuid.UUID] = [program.created_by]

    # Add the client's assigned RM if different from the program creator
    client_result = await db.execute(select(Client).where(Client.id == program.client_id))
    client = client_result.scalar_one_or_none()
    if client and client.rm_id and client.rm_id not in recipients:
        recipients.append(client.rm_id)

    return recipients


async def _notify_users(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
    notification_type: str,
    title: str,
    body: str,
    entity_type: str,
    entity_id: uuid.UUID,
    action_url: str | None = None,
    priority: str = "normal",
) -> None:
    """Create an in-portal notification for each user in *user_ids*."""
    for uid in user_ids:
        try:
            await notification_service.create_notification(
                db,
                CreateNotificationRequest(
                    user_id=uid,
                    notification_type=notification_type,
                    title=title,
                    body=body,
                    action_url=action_url,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    priority=priority,
                ),
            )
        except Exception:
            logger.exception(
                "Failed to send '%s' notification to user %s",
                notification_type,
                uid,
            )


async def _handle_milestone_completed(
    db: AsyncSession,
    milestone: Milestone,
    program: Program,
) -> None:
    """Side-effects when a milestone transitions to *completed*."""
    logger.info(
        "Milestone '%s' (%s) auto-completed — all tasks done.",
        milestone.title,
        milestone.id,
    )

    recipients = await _collect_notification_recipients(db, program)
    await _notify_users(
        db,
        recipients,
        notification_type=NotificationType.milestone_update,
        title=f"Milestone completed: {milestone.title}",
        body=(
            f"All tasks in milestone '{milestone.title}' are now done. "
            f"The milestone has been automatically marked as completed."
        ),
        entity_type="milestone",
        entity_id=milestone.id,
        action_url=f"/programs/{program.id}",
        priority="normal",
    )

    # Check whether every milestone in the program is now terminal
    all_milestones_result = await db.execute(
        select(Milestone).where(Milestone.program_id == program.id)
    )
    all_milestones = list(all_milestones_result.scalars().all())

    non_terminal = [
        m
        for m in all_milestones
        if m.status not in (MilestoneStatus.completed, MilestoneStatus.cancelled)
    ]
    if not non_terminal:
        logger.info(
            "All milestones in program '%s' (%s) are complete — notifying RM.",
            program.title,
            program.id,
        )
        await _notify_users(
            db,
            recipients,
            notification_type=NotificationType.milestone_update,
            title=f"All milestones complete — {program.title}",
            body=(
                f"Every milestone in program '{program.title}' has been completed or cancelled. "
                "Consider initiating program closure."
            ),
            entity_type="program",
            entity_id=program.id,
            action_url=f"/programs/{program.id}",
            priority="high",
        )

    # Log the updated RAG status for visibility
    rag = compute_rag_status(all_milestones)
    logger.info(
        "Program '%s' (%s) RAG status after milestone completion: %s",
        program.title,
        program.id,
        rag,
    )


async def on_task_status_change(
    db: AsyncSession,
    task_id: uuid.UUID,
    new_status: str,
) -> None:
    """Apply cascade logic after a task's status has changed.

    This function is idempotent — calling it multiple times with the same
    arguments produces the same result.  It should be invoked *after* the
    task update has been flushed/committed so that the sibling task list
    reflects the latest state.

    Parameters
    ----------
    db:
        Active async SQLAlchemy session.
    task_id:
        UUID of the task whose status just changed.
    new_status:
        The new ``TaskStatus`` value (string).
    """
    # Load the task's milestone together with all its sibling tasks and the
    # parent program so we have everything we need in a single round-trip.
    result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.milestone).options(
                selectinload(Milestone.tasks),
                selectinload(Milestone.program),
            )
        )
        .where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if task is None:
        logger.warning("on_task_status_change: task %s not found — skipping.", task_id)
        return

    milestone = task.milestone
    if milestone is None:
        logger.warning("on_task_status_change: task %s has no milestone — skipping.", task_id)
        return

    program = milestone.program
    if program is None:
        logger.warning(
            "on_task_status_change: milestone %s has no program — skipping.", milestone.id
        )
        return

    # Milestones that were explicitly closed should not be touched by cascade
    if milestone.status == MilestoneStatus.cancelled:
        return

    desired = _derive_milestone_status(milestone.tasks or [])

    if desired == milestone.status:
        # Nothing to change — exit early
        return

    old_status = milestone.status
    milestone.status = desired
    await db.commit()

    logger.info(
        "Milestone '%s' (%s) cascaded from '%s' → '%s' (triggered by task %s → '%s').",
        milestone.title,
        milestone.id,
        old_status,
        desired,
        task_id,
        new_status,
    )

    if desired == MilestoneStatus.completed:
        await _handle_milestone_completed(db, milestone, program)
    elif desired == MilestoneStatus.at_risk:
        # Notify the team that a blocked task is putting the milestone at risk
        recipients = await _collect_notification_recipients(db, program)
        await _notify_users(
            db,
            recipients,
            notification_type=NotificationType.milestone_update,
            title=f"Milestone at risk: {milestone.title}",
            body=(
                f"A task in milestone '{milestone.title}' has been marked as blocked. "
                "The milestone has been flagged as at risk."
            ),
            entity_type="milestone",
            entity_id=milestone.id,
            action_url=f"/programs/{program.id}",
            priority="high",
        )

        # Recompute and log RAG
        all_milestones_result = await db.execute(
            select(Milestone).where(Milestone.program_id == program.id)
        )
        all_milestones = list(all_milestones_result.scalars().all())
        rag = compute_rag_status(all_milestones)
        logger.info(
            "Program '%s' (%s) RAG status after milestone at-risk update: %s",
            program.title,
            program.id,
            rag,
        )


async def on_task_created(
    db: AsyncSession,
    task_id: uuid.UUID,
) -> None:
    """Reverse cascade: if a new task is added to a completed milestone, revert it.

    A completed milestone that receives a new (non-terminal) task should revert
    to ``in_progress`` so that the team knows there is outstanding work.

    Parameters
    ----------
    db:
        Active async SQLAlchemy session.
    task_id:
        UUID of the newly created task.
    """
    result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.milestone).options(
                selectinload(Milestone.tasks),
                selectinload(Milestone.program),
            )
        )
        .where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if task is None:
        return

    milestone = task.milestone
    if milestone is None:
        return

    # Only act when the milestone was previously completed
    if milestone.status != MilestoneStatus.completed:
        return

    # The new task starts as "todo" which is not terminal — revert
    milestone.status = MilestoneStatus.in_progress
    await db.commit()

    logger.info(
        "Milestone '%s' (%s) reverted from 'completed' to 'in_progress' "
        "because a new task was added.",
        milestone.title,
        milestone.id,
    )

    if milestone.program:
        rag = compute_rag_status(
            list(
                (
                    await db.execute(
                        select(Milestone).where(Milestone.program_id == milestone.program_id)
                    )
                )
                .scalars()
                .all()
            )
        )
        logger.info(
            "Program '%s' (%s) RAG status after milestone revert: %s",
            milestone.program.title,
            milestone.program_id,
            rag,
        )
