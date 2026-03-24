"""Task service — bulk operations and shared business logic."""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.task import Task
from app.schemas.task import BulkUpdateFailure, TaskBulkUpdate, TaskBulkUpdateResult

logger = logging.getLogger(__name__)


def _build_audit_after_state(data: TaskBulkUpdate) -> dict[str, object]:
    """Describe the desired after-state for the audit log entry."""
    after: dict[str, object] = {}
    if data.delete:
        after["action"] = "bulk_delete"
        return after
    if data.status is not None:
        after["status"] = data.status.value
    if data.priority is not None:
        after["priority"] = data.priority.value
    if data.clear_due_date:
        after["due_date"] = None
    elif data.due_date is not None:
        after["due_date"] = data.due_date.isoformat()
    if data.clear_assignee:
        after["assigned_to"] = None
    elif data.assigned_to is not None:
        after["assigned_to"] = str(data.assigned_to)
    return after


def _apply_update(task: Task, data: TaskBulkUpdate) -> bool:
    """Apply field changes to a task in-place. Returns True if status changed."""
    old_status = task.status
    if data.status is not None:
        task.status = data.status.value  # type: ignore[assignment]
    if data.priority is not None:
        task.priority = data.priority.value  # type: ignore[assignment]
    if data.clear_due_date:
        task.due_date = None
    elif data.due_date is not None:
        task.due_date = data.due_date
    if data.clear_assignee:
        task.assigned_to = None
    elif data.assigned_to is not None:
        task.assigned_to = data.assigned_to
    return data.status is not None and task.status != old_status


async def bulk_update(
    db: AsyncSession,
    data: TaskBulkUpdate,
    actor_id: uuid.UUID,
    actor_email: str,
) -> TaskBulkUpdateResult:
    """Perform bulk update or delete, cascade milestone statuses, and write an audit entry."""
    from app.services.task_cascade_service import on_task_status_change

    updated_count = 0
    deleted_count = 0
    failures: list[BulkUpdateFailure] = []
    status_changed: list[tuple[uuid.UUID, str]] = []

    for task_id in data.task_ids:
        try:
            result = await db.execute(select(Task).where(Task.id == task_id))
            task = result.scalar_one_or_none()
            if not task:
                failures.append(
                    BulkUpdateFailure(task_id=str(task_id), error="Task not found")
                )
                continue

            if data.delete:
                await db.delete(task)
                deleted_count += 1
            else:
                if _apply_update(task, data):
                    status_changed.append((task_id, task.status))
                updated_count += 1

        except Exception as exc:
            logger.exception("Bulk update failed for task %s", task_id)
            failures.append(BulkUpdateFailure(task_id=str(task_id), error=str(exc)))

    await db.commit()

    for changed_id, new_status in status_changed:
        try:
            await on_task_status_change(db, changed_id, new_status)
        except Exception:
            logger.exception(
                "Task cascade failed for bulk-updated task %s — milestone not updated.",
                changed_id,
            )

    after_state = _build_audit_after_state(data)
    after_state.update(
        {
            "updated": updated_count,
            "deleted": deleted_count,
            "failed": len(failures),
        }
    )
    audit = AuditLog(
        user_id=actor_id,
        user_email=actor_email,
        action="update" if not data.delete else "delete",
        entity_type="task_bulk",
        entity_id=f"bulk:{updated_count + deleted_count}",
        before_state={"task_ids": [str(t) for t in data.task_ids]},
        after_state=after_state,
    )
    db.add(audit)
    await db.commit()

    return TaskBulkUpdateResult(
        updated=updated_count,
        deleted=deleted_count,
        failed=failures,
    )
