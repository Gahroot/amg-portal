"""Pydantic schemas for recurring task templates."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.models.enums import TaskPriority


class RecurringTaskTemplateCreate(BaseModel):
    name: str
    description: str | None = None
    rrule: str
    milestone_id: UUID | None = None
    assignee_id: UUID | None = None
    priority: TaskPriority = TaskPriority.medium
    task_title_template: str
    task_description: str | None = None

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
    name: str | None = None
    description: str | None = None
    rrule: str | None = None
    milestone_id: UUID | None = None
    assignee_id: UUID | None = None
    priority: TaskPriority | None = None
    task_title_template: str | None = None
    task_description: str | None = None
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
    name: str
    description: str | None
    rrule: str
    milestone_id: UUID | None
    assignee_id: UUID | None
    priority: str
    task_title_template: str
    task_description: str | None
    next_due_date: date | None
    last_triggered_at: datetime | None
    is_active: bool
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    milestone_title: str | None = None
    assignee_name: str | None = None


class RecurringTaskTemplateListResponse(BaseModel):
    templates: list[RecurringTaskTemplateResponse]
    total: int
