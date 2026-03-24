from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import TaskPriority, TaskStatus


class TaskBoardCreate(BaseModel):
    title: str
    description: str | None = None
    milestone_id: UUID
    due_date: date | None = None
    assigned_to: UUID | None = None
    priority: TaskPriority = TaskPriority.medium
    depends_on: list[UUID] | None = None


class TaskBoardUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: date | None = None
    assigned_to: UUID | None = None
    depends_on: list[UUID] | None = None


class TaskReorder(BaseModel):
    task_id: UUID
    new_status: str
    after_task_id: UUID | None = None  # Task to place after, None for first position


class AssigneeInfo(BaseModel):
    id: UUID
    name: str
    email: str


class ProgramInfo(BaseModel):
    id: UUID
    title: str
    status: str


class MilestoneInfo(BaseModel):
    id: UUID
    title: str
    program_id: UUID


class TaskDependencyUpdate(BaseModel):
    depends_on: list[UUID]


class TaskBoardResponse(BaseModel):
    id: UUID
    milestone_id: UUID
    title: str
    description: str | None
    status: str
    priority: str
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
    status: str | None = None
    priority: str | None = None
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
    task_id: str
    error: str


class TaskBulkUpdateResult(BaseModel):
    updated: int
    deleted: int
    failed: list[BulkUpdateFailure]
