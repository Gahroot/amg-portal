from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import TaskPriority, TaskStatus
from app.schemas.base import Str50, Str100, Str255, Str500, Str2000


class TaskBoardCreate(BaseModel):
    title: Str255
    description: Str2000 | None = None
    milestone_id: UUID
    due_date: date | None = None
    assigned_to: UUID | None = None
    priority: TaskPriority = TaskPriority.medium
    depends_on: list[UUID] | None = None


class TaskBoardUpdate(BaseModel):
    title: Str255 | None = None
    description: Str2000 | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: date | None = None
    assigned_to: UUID | None = None
    depends_on: list[UUID] | None = None


class TaskReorder(BaseModel):
    task_id: UUID
    new_status: Str50
    after_task_id: UUID | None = None  # Task to place after, None for first position


class AssigneeInfo(BaseModel):
    id: UUID
    name: Str255
    email: Str255


class ProgramInfo(BaseModel):
    id: UUID
    title: Str255
    status: Str50


class MilestoneInfo(BaseModel):
    id: UUID
    title: Str255
    program_id: UUID


class TaskDependencyUpdate(BaseModel):
    depends_on: list[UUID]


class TaskBoardResponse(BaseModel):
    id: UUID
    milestone_id: UUID
    title: Str255
    description: Str2000 | None
    status: Str50
    priority: Str50
    due_date: date | None
    assigned_to: UUID | None
    assignee: AssigneeInfo | None = None
    program: ProgramInfo | None = None
    milestone: MilestoneInfo | None = None
    position: int = 0
    depends_on: list[UUID] = []
    blocked_by: list[UUID] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskBoardListResponse(BaseModel):
    tasks: list[TaskBoardResponse]
    total: int


class TaskFilters(BaseModel):
    program_id: UUID | None = None
    assignee_id: UUID | None = None
    status: Str50 | None = None
    priority: Str50 | None = None
    overdue_only: bool = False


class TaskBulkUpdate(BaseModel):
    """Payload for bulk-updating or bulk-deleting tasks."""

    task_ids: list[UUID]
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    # Use empty string sentinel on the wire; None means "don't touch"
    due_date: date | None = None
    clear_due_date: bool = False  # set due_date to NULL
    assigned_to: UUID | None = None
    clear_assignee: bool = False  # set assigned_to to NULL
    delete: bool = False  # if True, delete all task_ids instead of updating


class BulkUpdateFailure(BaseModel):
    task_id: Str100
    error: Str500


class TaskBulkUpdateResult(BaseModel):
    updated: int
    deleted: int
    failed: list[BulkUpdateFailure]
