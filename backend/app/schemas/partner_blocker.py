"""Pydantic schemas for PartnerBlocker."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.schemas.base import Str50, Str255, Str500


class PartnerBlockerCreate(BaseModel):
    start_date: date
    end_date: date
    reason: Str500 | None = None
    blocker_type: Str50 = "other"
    is_recurring: bool = False
    recurrence_type: Str50 | None = None
    recurrence_days: list[int] | None = None

    @field_validator("blocker_type")
    @classmethod
    def validate_blocker_type(cls, v: str) -> str:
        allowed = {"day_off", "vacation", "training", "other"}
        if v not in allowed:
            raise ValueError(f"blocker_type must be one of {allowed}")
        return v

    @field_validator("recurrence_type")
    @classmethod
    def validate_recurrence_type(cls, v: str | None) -> str | None:
        if v is not None and v not in {"weekly"}:
            raise ValueError("recurrence_type must be 'weekly' or null")
        return v

    @field_validator("recurrence_days")
    @classmethod
    def validate_recurrence_days(cls, v: list[int] | None) -> list[int] | None:
        if v is not None:
            for d in v:
                if d < 1 or d > 7:
                    raise ValueError("recurrence_days must be ISO weekday numbers 1–7")
        return v

    @model_validator(mode="after")
    def validate_dates(self) -> "PartnerBlockerCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be >= start_date")
        if (self.end_date - self.start_date).days > 365:
            raise ValueError("Blocker range cannot exceed 365 days")
        if self.is_recurring and not self.recurrence_type:
            raise ValueError("recurrence_type is required when is_recurring=True")
        if self.is_recurring and self.recurrence_type == "weekly" and not self.recurrence_days:
            raise ValueError("recurrence_days is required for weekly recurring blockers")
        return self


class PartnerBlockerResponse(BaseModel):
    id: UUID
    partner_id: UUID
    start_date: date
    end_date: date
    reason: Str500 | None
    blocker_type: Str50
    is_recurring: bool
    recurrence_type: Str50 | None
    recurrence_days: list[int] | None
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BlockerConflict(BaseModel):
    """An existing assignment whose due_date falls inside a blocker range."""

    assignment_id: UUID
    assignment_title: Str255
    program_title: Str255 | None
    due_date: date
    status: Str50


class PartnerBlockerCreateResponse(BaseModel):
    """Extended create response that also lists any assignment conflicts."""

    blocker: PartnerBlockerResponse
    conflicts: list[BlockerConflict]


class PartnerAvailabilityDay(BaseModel):
    """Availability info for a single date (used in the RM assignment view)."""

    date: date
    is_blocked: bool
    blocker_id: UUID | None = None
    blocker_type: Str50 | None = None
    reason: Str500 | None = None
    is_recurring: bool = False


class PartnerAvailabilityResponse(BaseModel):
    partner_id: UUID
    start_date: date
    end_date: date
    days: dict[str, PartnerAvailabilityDay]  # ISO date → day info
