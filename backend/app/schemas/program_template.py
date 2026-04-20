from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str255, Str2000


class MilestoneTemplateTask(BaseModel):
    title: Str255
    description: Str2000 | None = None
    priority: Str50 = "medium"  # low / medium / high / urgent


class MilestoneTemplateItem(BaseModel):
    title: Str255
    description: Str2000 | None = None
    offset_days: int = 0
    duration_days: int = 7
    tasks: list[MilestoneTemplateTask] = []


class ProgramTemplateCreate(BaseModel):
    name: Str255
    description: Str2000 | None = None
    category: Str50
    milestones_template: list[MilestoneTemplateItem] = []
    estimated_duration_days: int | None = None


class ProgramTemplateUpdate(BaseModel):
    name: Str255 | None = None
    description: Str2000 | None = None
    category: Str50 | None = None
    milestones_template: list[MilestoneTemplateItem] | None = None
    estimated_duration_days: int | None = None
    is_active: bool | None = None


class ProgramTemplateResponse(BaseModel):
    id: UUID
    name: Str255
    description: Str2000 | None
    category: Str50
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
