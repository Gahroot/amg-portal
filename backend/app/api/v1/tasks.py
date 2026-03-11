"""Task board API for drag-and-drop task management."""

import logging
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, require_coordinator_or_above, require_internal
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
    TaskReorder,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def build_task_response(
    task: Task,
    assignee: User | None = None,
    program: Program | None = None,
    milestone: Milestone | None = None,
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
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }

    if assignee:
        response["assignee"] = AssigneeInfo(
            id=assignee.id,
            name=assignee.name,
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


@router.get("/", response_model=TaskBoardListResponse)
async def list_tasks(
    db: DB,
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

    count_query = (
        select(func.count())
        .select_from(Task)
        .join(Milestone, Task.milestone_id == Milestone.id)
        .join(Program, Milestone.program_id == Program.id)
    )

    # Apply filters
    filters = []
    if program_id:
        filters.append(Milestone.program_id == program_id)
    if assignee_id:
        filters.append(Task.assigned_to == assignee_id)
    if status_filter:
        filters.append(Task.status == status_filter)
    if priority:
        filters.append(Task.priority == priority)
    if overdue_only:
        filters.append(
            and_(Task.due_date < date.today(), Task.status != "done", Task.status != "cancelled")
        )

    for f in filters:
        query = query.where(f)
        count_query = count_query.where(f)

    total = (await db.execute(count_query)).scalar_one()

    # Order by status column order, then by position
    query = query.order_by(
        Task.status,
        Task.position,
        Task.created_at.desc(),
    ).offset(skip).limit(limit)

    result = await db.execute(query)
    tasks = result.scalars().unique().all()

    task_responses = []
    for task in tasks:
        assignee = task.assignee
        milestone = task.milestone
        program = milestone.program if milestone else None
        task_responses.append(
            TaskBoardResponse(
                **build_task_response(task, assignee, program, milestone)
            )
        )

    return TaskBoardListResponse(tasks=task_responses, total=total)


@router.post("/", response_model=TaskBoardResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskBoardCreate,
    db: DB,
    current_user: CurrentUser,
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")

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
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

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


@router.patch("/{task_id}", response_model=TaskBoardResponse)
async def update_task(
    task_id: uuid.UUID,
    data: TaskBoardUpdate,
    db: DB,
    current_user: CurrentUser,
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = update_data["status"].value
    if "priority" in update_data and update_data["priority"] is not None:
        update_data["priority"] = update_data["priority"].value

    for field, value in update_data.items():
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)

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
    _: None = Depends(require_coordinator_or_above),
):
    """Reorder tasks after drag-and-drop. Updates status and position."""
    result = await db.execute(select(Task).where(Task.id == data.task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Get all tasks in the target column, ordered by position
    tasks_result = await db.execute(
        select(Task)
        .where(Task.status == data.new_status)
        .order_by(Task.position)
    )
    column_tasks = list(tasks_result.scalars().all())

    # Remove the moved task from the list if it was already in this column
    column_tasks = [t for t in column_tasks if t.id != data.task_id]

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

    await db.commit()


@router.post("/batch-reorder", status_code=status.HTTP_204_NO_CONTENT)
async def batch_reorder_tasks(
    updates: list[TaskReorder],
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_coordinator_or_above),
):
    """Batch reorder multiple tasks at once."""
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

    await db.commit()


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_coordinator_or_above),
):
    """Delete a task."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    await db.delete(task)
    await db.commit()


@router.get("/programs", response_model=list[ProgramInfo])
async def list_programs_for_filter(
    db: DB,
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
    _: None = Depends(require_internal),
):
    """List all internal users for the assignee filter dropdown."""
    from app.models.enums import INTERNAL_ROLES

    result = await db.execute(
        select(User)
        .where(User.role.in_([r.value for r in INTERNAL_ROLES]))
        .where(User.is_active.is_(True))
        .order_by(User.name)
    )
    users = result.scalars().all()
    return [
        AssigneeInfo(id=u.id, name=u.name, email=u.email)
        for u in users
    ]
