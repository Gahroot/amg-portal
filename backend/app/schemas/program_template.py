from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MilestoneTemplateTask(BaseModel):
    title: str
    description: str | None = None
    priority: str = "medium"  # low / medium / high / urgent


class MilestoneTemplateItem(BaseModel):
    title: str
    description: str | None = None
    offset_days: int = 0
    duration_days: int = 7
    tasks: list[MilestoneTemplateTask] = []


class ProgramTemplateCreate(BaseModel):
    name: str
    description: str | None = None
    category: str
    milestones_template: list[MilestoneTemplateItem] = []
    estimated_duration_days: int | None = None


class ProgramTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    milestones_template: list[MilestoneTemplateItem] | None = None
    estimated_duration_days: int | None = None
    is_active: bool | None = None


class ProgramTemplateResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    category: str
    milestones_template: list[dict[str, Any]] | None
    estimated_duration_days: int | None
    is_system_template: bool
    is_active: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProgramTemplateListResponse(BaseModel):
    templates: list[ProgramTemplateResponse]
    total: int
