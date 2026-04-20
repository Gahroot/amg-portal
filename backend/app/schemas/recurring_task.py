"""Pydantic schemas for recurring task templates."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.models.enums import TaskPriority
from app.schemas.base import Str50, Str255, Str500, Str2000


class RecurringTaskTemplateCreate(BaseModel):
    name: Str255
    description: Str2000 | None = None
    rrule: Str500
    milestone_id: UUID | None = None
    assignee_id: UUID | None = None
    priority: TaskPriority = TaskPriority.medium
    task_title_template: Str255
    task_description: Str2000 | None = None

    @field_validator("rrule")
    @classmethod
    def validate_rrule(cls, v: str) -> str:
        try:
            from datetime import datetime as dt

            from dateutil.rrule import rrulestr  # type: ignore[import-untyped, unused-ignore]

            rrulestr(v, dtstart=dt(2026, 1, 1))
        except Exception as exc:
            raise ValueError(f"Invalid RRULE string: {exc}") from exc
        return v


class RecurringTaskTemplateUpdate(BaseModel):
    name: Str255 | None = None
    description: Str2000 | None = None
    rrule: Str500 | None = None
    milestone_id: UUID | None = None
    assignee_id: UUID | None = None
    priority: TaskPriority | None = None
    task_title_template: Str255 | None = None
    task_description: Str2000 | None = None
    is_active: bool | None = None

    @field_validator("rrule")
    @classmethod
    def validate_rrule(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            from datetime import datetime as dt

            from dateutil.rrule import rrulestr

            rrulestr(v, dtstart=dt(2026, 1, 1))
        except Exception as exc:
            raise ValueError(f"Invalid RRULE string: {exc}") from exc
        return v


class RecurringTaskTemplateResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    name: Str255
    description: Str2000 | None
    rrule: Str500
    milestone_id: UUID | None
    assignee_id: UUID | None
    priority: Str50
    task_title_template: Str255
    task_description: Str2000 | None
    next_due_date: date | None
    last_triggered_at: datetime | None
    is_active: bool
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    milestone_title: Str255 | None = None
    assignee_name: Str255 | None = None


class RecurringTaskTemplateListResponse(BaseModel):
    templates: list[RecurringTaskTemplateResponse]
    total: int
