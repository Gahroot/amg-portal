from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import TaskPriority, TaskStatus


class TaskBoardCreate(BaseModel):
    title: str
    description: str | None = None
    milestone_id: UUID
    due_date: date | None = None
    assigned_to: UUID | None = None
    priority: TaskPriority = TaskPriority.medium


class TaskBoardUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: date | None = None
    assigned_to: UUID | None = None


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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskBoardListResponse(BaseModel):
    tasks: list[TaskBoardResponse]
    total: int


class TaskFilters(BaseModel):
    program_id: UUID | None = None
    assignee_id: UUID | None = None
    status: str | None = None
    priority: str | None = None
    overdue_only: bool = False
