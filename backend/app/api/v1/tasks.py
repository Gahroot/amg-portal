"""Task board API for drag-and-drop task management."""

import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, RLSContext, require_coordinator_or_above, require_internal
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.task import Task
from app.models.user import User
from app.schemas.task import (
    AssigneeInfo,
    MilestoneInfo,
    ProgramInfo,
    TaskBoardCreate,
    TaskBoardListResponse,
    TaskBoardResponse,
    TaskBoardUpdate,
    TaskBulkUpdate,
    TaskBulkUpdateResult,
    TaskDependencyUpdate,
    TaskReorder,
)
from app.services.crud_base import paginate

logger = logging.getLogger(__name__)

router = APIRouter()


def build_task_response(
    task: Task,
    assignee: User | None = None,
    program: Program | None = None,
    milestone: Milestone | None = None,
    blocked_by: list[uuid.UUID] | None = None,
) -> dict:
    """Build a task response with related entity info."""
    response = {
        "id": task.id,
        "milestone_id": task.milestone_id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "due_date": task.due_date,
        "assigned_to": task.assigned_to,
        "position": task.position,
        "depends_on": task.depends_on or [],
        "blocked_by": blocked_by or [],
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }

    if assignee:
        response["assignee"] = AssigneeInfo(
            id=assignee.id,
            name=assignee.full_name,
            email=assignee.email,
        ).model_dump()

    if program:
        response["program"] = ProgramInfo(
            id=program.id,
            title=program.title,
            status=program.status,
        ).model_dump()

    if milestone:
        response["milestone"] = MilestoneInfo(
            id=milestone.id,
            title=milestone.title,
            program_id=milestone.program_id,
        ).model_dump()

    return response


def _detect_cycle(
    task_id: uuid.UUID,
    new_deps: list[uuid.UUID],
    all_tasks_deps: dict[uuid.UUID, list[uuid.UUID]],
) -> bool:
    """Return True if adding new_deps to task_id would create a cycle.

    Uses DFS: starting from each dep, check if we can reach task_id.
    """
    deps_map = dict(all_tasks_deps)
    deps_map[task_id] = new_deps

    visited: set[uuid.UUID] = set()

    def dfs(node: uuid.UUID, target: uuid.UUID) -> bool:
        if node == target:
            return True
        if node in visited:
            return False
        visited.add(node)
        return any(dfs(dep, target) for dep in deps_map.get(node, []))

    for dep in new_deps:
        visited.clear()
        if dfs(dep, task_id):
            return True
    return False


@router.get("/", response_model=TaskBoardListResponse)
async def list_tasks(
    db: DB,
    _rls: RLSContext,
    program_id: uuid.UUID | None = Query(None),
    assignee_id: uuid.UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    priority: str | None = Query(None),
    overdue_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    _: None = Depends(require_internal),
):
    """List all tasks with filtering for the task board."""
    # Build query with joins
    query = (
        select(Task)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.milestone).selectinload(Milestone.program),
        )
        .join(Milestone, Task.milestone_id == Milestone.id)
        .join(Program, Milestone.program_id == Program.id)
    )

    if program_id:
        query = query.where(Milestone.program_id == program_id)
    if assignee_id:
        query = query.where(Task.assigned_to == assignee_id)
    if status_filter:
        query = query.where(Task.status == status_filter)
    if priority:
        query = query.where(Task.priority == priority)
    if overdue_only:
        query = query.where(
            and_(
                Task.due_date < datetime.now(UTC).date(),
                Task.status != "done",
                Task.status != "cancelled",
            )
        )

    # Order by status column order, then by position
    query = query.order_by(
        Task.status,
        Task.position,
        Task.created_at.desc(),
    )

    tasks, total = await paginate(db, query, skip=skip, limit=limit, unique=True)

    # Build blocked_by map: for each task, find which tasks depend on it
    blocked_by_map: dict[uuid.UUID, list[uuid.UUID]] = {}
    for task in tasks:
        for dep_id in (task.depends_on or []):
            blocked_by_map.setdefault(dep_id, []).append(task.id)

    task_responses = []
    for task in tasks:
        assignee = task.assignee
        milestone = task.milestone
        program = milestone.program if milestone else None
        task_responses.append(
            TaskBoardResponse(
                **build_task_response(
                    task,
                    assignee,
                    program,
                    milestone,
                    blocked_by=blocked_by_map.get(task.id, []),
                )
            )
        )

    return TaskBoardListResponse(tasks=task_responses, total=total)


@router.post("/", response_model=TaskBoardResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskBoardCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
):
    """Create a new task."""
    # Verify milestone exists
    result = await db.execute(
        select(Milestone)
        .options(selectinload(Milestone.program))
        .where(Milestone.id == data.milestone_id)
    )
    milestone = result.scalar_one_or_none()
    if not milestone:
        raise NotFoundException("Milestone not found")

    # Get max position for this status (default to 'todo')
    max_pos_result = await db.execute(
        select(func.max(Task.position)).where(Task.status == "todo")
    )
    max_pos = max_pos_result.scalar() or 0

    task = Task(
        milestone_id=data.milestone_id,
        title=data.title,
        description=data.description,
        status="todo",
        priority=data.priority.value,
        due_date=data.due_date,
        assigned_to=data.assigned_to,
        position=max_pos + 1,
        depends_on=data.depends_on or [],
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # Reverse cascade: revert a completed milestone when a new task is added
    try:
        from app.services.task_cascade_service import on_task_created

        await on_task_created(db, task.id)
    except Exception:
        logger.exception(
            "Task cascade (on_task_created) failed for task %s.",
            task.id,
        )

    # Load relationships
    result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.milestone).selectinload(Milestone.program),
        )
        .where(Task.id == task.id)
    )
    task = result.scalar_one()

    return TaskBoardResponse(
        **build_task_response(task, task.assignee, task.milestone.program, task.milestone)
    )


@router.get("/{task_id}", response_model=TaskBoardResponse)
async def get_task(
    task_id: uuid.UUID,
    db: DB,
    _rls: RLSContext,
    _: None = Depends(require_internal),
):
    """Get a single task by ID."""
    result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.milestone).selectinload(Milestone.program),
        )
        .where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise NotFoundException("Task not found")
    return TaskBoardResponse(
        **build_task_response(
            task,
            task.assignee,
            task.milestone.program if task.milestone else None,
            task.milestone,
        )
    )


@router.patch("/{task_id}", response_model=TaskBoardResponse)
async def update_task(
    task_id: uuid.UUID,
    data: TaskBoardUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
):
    """Update a task (title, description, status, priority, due_date, assigned_to)."""
    result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.milestone).selectinload(Milestone.program),
        )
        .where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise NotFoundException("Task not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = update_data["status"].value
    if "priority" in update_data and update_data["priority"] is not None:
        update_data["priority"] = update_data["priority"].value

    status_changed = "status" in update_data

    for field, value in update_data.items():
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)

    # Cascade milestone status when a task's status changes
    if status_changed:
        try:
            from app.services.task_cascade_service import on_task_status_change

            await on_task_status_change(db, task_id, task.status)
        except Exception:
            logger.exception(
                "Task cascade failed for task %s — milestone status not updated.",
                task_id,
            )

    # Reload with relationships
    result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.milestone).selectinload(Milestone.program),
        )
        .where(Task.id == task_id)
    )
    task = result.scalar_one()

    return TaskBoardResponse(
        **build_task_response(task, task.assignee, task.milestone.program, task.milestone)
    )


@router.post("/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_tasks(
    data: TaskReorder,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
):
    """Reorder tasks after drag-and-drop. Updates status and position."""
    result = await db.execute(select(Task).where(Task.id == data.task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise NotFoundException("Task not found")

    # Get all tasks in the target column, ordered by position
    tasks_result = await db.execute(
        select(Task)
        .where(Task.status == data.new_status)
        .order_by(Task.position)
    )
    column_tasks = list(tasks_result.scalars().all())

    # Remove the moved task from the list if it was already in this column
    column_tasks = [t for t in column_tasks if t.id != data.task_id]

    # Capture old status before mutating so cascade can detect the change
    old_task_status = task.status

    # Update the task's status
    task.status = data.new_status

    # Insert at the correct position
    if data.after_task_id is None:
        # Place at the beginning
        column_tasks.insert(0, task)
    else:
        # Find the position after the specified task
        insert_idx = 0
        for i, t in enumerate(column_tasks):
            if t.id == data.after_task_id:
                insert_idx = i + 1
                break
        column_tasks.insert(insert_idx, task)

    # Update positions for all tasks in the column
    for i, t in enumerate(column_tasks):
        t.position = i

    status_changed = old_task_status != data.new_status
    await db.commit()

    if status_changed:
        try:
            from app.services.task_cascade_service import on_task_status_change

            await on_task_status_change(db, data.task_id, data.new_status)
        except Exception:
            logger.exception(
                "Task cascade failed for reordered task %s — milestone status not updated.",
                data.task_id,
            )


@router.post("/batch-reorder", status_code=status.HTTP_204_NO_CONTENT)
async def batch_reorder_tasks(
    updates: list[TaskReorder],
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
):
    """Batch reorder multiple tasks at once."""
    # Track tasks whose status actually changed so we can cascade after commit
    status_changed_tasks: list[tuple[uuid.UUID, str]] = []

    for update in updates:
        result = await db.execute(select(Task).where(Task.id == update.task_id))
        task = result.scalar_one_or_none()
        if not task:
            continue

        # Get all tasks in the target column
        tasks_result = await db.execute(
            select(Task)
            .where(Task.status == update.new_status)
            .order_by(Task.position)
        )
        column_tasks = list(tasks_result.scalars().all())

        # Remove the moved task from the list if it was already in this column
        column_tasks = [t for t in column_tasks if t.id != update.task_id]

        # Capture old status before mutation
        old_status = task.status

        # Update the task's status
        task.status = update.new_status

        # Insert at the correct position
        if update.after_task_id is None:
            column_tasks.insert(0, task)
        else:
            insert_idx = 0
            for i, t in enumerate(column_tasks):
                if t.id == update.after_task_id:
                    insert_idx = i + 1
                    break
            column_tasks.insert(insert_idx, task)

        # Update positions
        for i, t in enumerate(column_tasks):
            t.position = i

        if old_status != update.new_status:
            status_changed_tasks.append((update.task_id, update.new_status))

    await db.commit()

    # Cascade milestone status for each task whose status changed
    for changed_task_id, new_status in status_changed_tasks:
        try:
            from app.services.task_cascade_service import on_task_status_change

            await on_task_status_change(db, changed_task_id, new_status)
        except Exception:
            logger.exception(
                "Task cascade failed for batch-reordered task %s — milestone status not updated.",
                changed_task_id,
            )


@router.post("/bulk-update", response_model=TaskBulkUpdateResult)
async def bulk_update_tasks(
    data: TaskBulkUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
):
    """Bulk update or delete multiple tasks.

    Supports status/priority/due-date/assignee changes and bulk delete.
    Returns updated/deleted counts and any per-task failures.
    """
    from app.services.task_service import bulk_update

    return await bulk_update(
        db,
        data,
        actor_id=uuid.UUID(str(current_user.id)),
        actor_email=current_user.email,
    )


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
):
    """Delete a task."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise NotFoundException("Task not found")

    await db.delete(task)
    await db.commit()


@router.put("/{task_id}/dependencies", response_model=TaskBoardResponse)
async def update_task_dependencies(
    task_id: uuid.UUID,
    data: TaskDependencyUpdate,
    db: DB,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
):
    """Set the full list of dependencies for a task. Validates for circular deps."""
    result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.milestone).selectinload(Milestone.program),
        )
        .where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise NotFoundException("Task not found")

    # Validate all dependency IDs exist
    new_deps = list(dict.fromkeys(data.depends_on))  # deduplicate preserving order
    if task_id in new_deps:
        raise BadRequestException("A task cannot depend on itself")

    if new_deps:
        dep_result = await db.execute(
            select(Task.id).where(Task.id.in_(new_deps))
        )
        found_ids = {row[0] for row in dep_result.all()}
        missing = [str(d) for d in new_deps if d not in found_ids]
        if missing:
            raise BadRequestException(f"Dependency tasks not found: {', '.join(missing)}")

    # Load all tasks to check for cycles
    all_tasks_result = await db.execute(select(Task.id, Task.depends_on))
    all_tasks_deps: dict[uuid.UUID, list[uuid.UUID]] = {
        row[0]: row[1] or [] for row in all_tasks_result.all()
    }

    if _detect_cycle(task_id, new_deps, all_tasks_deps):
        raise BadRequestException("Setting these dependencies would create a circular dependency")

    task.depends_on = new_deps
    await db.commit()
    await db.refresh(task)

    # Compute blocked_by for this task from all tasks
    blocked_by_result = await db.execute(
        select(Task.id).where(Task.depends_on.contains([task_id]))
    )
    blocked_by = [row[0] for row in blocked_by_result.all()]

    return TaskBoardResponse(
        **build_task_response(
            task,
            task.assignee,
            task.milestone.program,
            task.milestone,
            blocked_by=blocked_by,
        )
    )


@router.get("/programs", response_model=list[ProgramInfo])
async def list_programs_for_filter(
    db: DB,
    _rls: RLSContext,
    _: None = Depends(require_internal),
):
    """List all programs for the filter dropdown."""
    result = await db.execute(
        select(Program)
        .where(Program.status.in_(["intake", "design", "active", "on_hold"]))
        .order_by(Program.title)
    )
    programs = result.scalars().all()
    return [
        ProgramInfo(id=p.id, title=p.title, status=p.status)
        for p in programs
    ]


@router.get("/assignees", response_model=list[AssigneeInfo])
async def list_assignees_for_filter(
    db: DB,
    _rls: RLSContext,
    _: None = Depends(require_internal),
):
    """List all internal users for the assignee filter dropdown."""
    from app.models.enums import INTERNAL_ROLES

    result = await db.execute(
        select(User)
        .where(User.role.in_([r.value for r in INTERNAL_ROLES]))
        .where(User.status == "active")
        .order_by(User.full_name)
    )
    users = result.scalars().all()
    return [
        AssigneeInfo(id=u.id, name=u.full_name, email=u.email)
        for u in users
    ]
