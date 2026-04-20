from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import (
    MilestoneStatus,
    ProgramStatus,
    TaskPriority,
    TaskStatus,
)
from app.schemas.base import Str50, Str255, Str2000, TextStr


class MilestoneCreate(BaseModel):
    title: Str255
    description: Str2000 | None = None
    due_date: date | None = None
    position: int = 0


class MilestoneUpdate(BaseModel):
    title: Str255 | None = None
    description: Str2000 | None = None
    due_date: date | None = None
    status: MilestoneStatus | None = None
    position: int | None = None


class TaskCreate(BaseModel):
    title: Str255
    description: Str2000 | None = None
    due_date: date | None = None
    assigned_to: UUID | None = None
    priority: TaskPriority = TaskPriority.medium


class TaskUpdate(BaseModel):
    title: Str255 | None = None
    description: Str2000 | None = None
    due_date: date | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    assigned_to: UUID | None = None


class TaskResponse(BaseModel):
    id: UUID
    milestone_id: UUID
    title: Str255
    description: Str2000 | None
    status: Str50
    priority: Str50
    due_date: date | None
    assigned_to: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MilestoneResponse(BaseModel):
    id: UUID
    program_id: UUID
    title: Str255
    description: Str2000 | None
    due_date: date | None
    status: Str50
    position: int
    calendar_event_id: Str255 | None = None
    task_count: int = 0
    completed_task_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MilestoneDetailResponse(MilestoneResponse):
    tasks: list[TaskResponse] = []


class ProgramCreate(BaseModel):
    client_id: UUID
    title: Str255
    objectives: Str2000 | None = None
    scope: Str2000 | None = None
    budget_envelope: Decimal | None = None
    start_date: date | None = None
    end_date: date | None = None
    milestones: list[MilestoneCreate] = []


class ProgramUpdate(BaseModel):
    title: Str255 | None = None
    objectives: Str2000 | None = None
    scope: Str2000 | None = None
    budget_envelope: Decimal | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: ProgramStatus | None = None
    brief_content: TextStr | None = None
    brief_visible_to_client: bool | None = None


class EmergencyActivationRequest(BaseModel):
    emergency_reason: Str2000


class ProgramResponse(BaseModel):
    id: UUID
    client_id: UUID
    client_name: Str255 = ""
    title: Str255
    objectives: Str2000 | None
    scope: Str2000 | None
    budget_envelope: Decimal | None
    start_date: date | None
    end_date: date | None
    status: Str50
    archived_at: datetime | None = None
    emergency_reason: Str2000 | None = None
    retrospective_due_at: datetime | None = None
    created_by: UUID
    rag_status: Str50 = "green"
    milestone_count: int = 0
    completed_milestone_count: int = 0
    created_at: datetime
    updated_at: datetime
    brief_content: TextStr | None = None
    brief_visible_to_client: bool = False
    brief_shared_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ProgramDetailResponse(ProgramResponse):
    milestones: list[MilestoneDetailResponse] = []


class ArchivalCandidateResponse(BaseModel):
    """A closed program eligible for archival."""

    program_id: UUID
    title: Str255
    client_id: UUID
    client_name: Str255
    closed_at: datetime
    eligible_at: datetime  # closed_at + DATA_RETENTION_DAYS


class ArchivalCandidateList(BaseModel):
    candidates: list[ArchivalCandidateResponse]
    total: int


class ProgramListResponse(BaseModel):
    programs: list[ProgramResponse]
    total: int


class ProgramSummaryMilestone(BaseModel):
    title: Str255
    status: Str50
    due_date: date | None


class ProgramSummary(BaseModel):
    id: UUID
    title: Str255
    status: Str50
    start_date: date | None
    end_date: date | None
    milestone_progress: float = 0.0
    milestones: list[ProgramSummaryMilestone] = []
