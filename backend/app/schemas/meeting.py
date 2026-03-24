"""Pydantic schemas for meeting scheduler."""

from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# ─── Meeting Types ─────────────────────────────────────────────────────────────

class MeetingTypeResponse(BaseModel):
    id: UUID
    slug: str
    label: str
    duration_minutes: int
    description: str | None = None
    is_active: bool
    display_order: int

    model_config = ConfigDict(from_attributes=True)


# ─── RM Availability ──────────────────────────────────────────────────────────

class RMAvailabilityCreate(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: time
    end_time: time
    buffer_minutes: int = Field(15, ge=0, le=120)


class RMAvailabilityUpdate(BaseModel):
    day_of_week: int | None = Field(None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    buffer_minutes: int | None = Field(None, ge=0, le=120)
    is_active: bool | None = None


class RMAvailabilityResponse(BaseModel):
    id: UUID
    rm_id: UUID
    day_of_week: int
    start_time: time
    end_time: time
    buffer_minutes: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Blackouts ────────────────────────────────────────────────────────────────

class RMBlackoutCreate(BaseModel):
    blackout_date: date
    reason: str | None = None


class RMBlackoutResponse(BaseModel):
    id: UUID
    rm_id: UUID
    blackout_date: date
    reason: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Available Slots (computed, not stored) ───────────────────────────────────

class AvailableSlot(BaseModel):
    """A computed time slot available for booking."""

    start_time: datetime
    end_time: datetime
    date: date
    rm_id: UUID


class AvailableSlotsResponse(BaseModel):
    slots: list[AvailableSlot]
    rm_id: UUID
    from_date: date
    to_date: date


# ─── Meetings ─────────────────────────────────────────────────────────────────

class MeetingBook(BaseModel):
    """Payload sent by a client to book a meeting."""

    meeting_type_id: UUID
    start_time: datetime
    timezone: str = "UTC"
    agenda: str | None = None


class MeetingCancelRequest(BaseModel):
    reason: str | None = None


class MeetingRescheduleRequest(BaseModel):
    new_start_time: datetime
    timezone: str | None = None
    reason: str | None = None


class MeetingTypeNestedResponse(BaseModel):
    id: UUID
    slug: str
    label: str
    duration_minutes: int

    model_config = ConfigDict(from_attributes=True)


class MeetingResponse(BaseModel):
    id: UUID
    meeting_type_id: UUID
    meeting_type: MeetingTypeNestedResponse | None = None
    rm_id: UUID
    client_id: UUID
    booked_by_user_id: UUID
    start_time: datetime
    end_time: datetime
    timezone: str
    status: str
    agenda: str | None = None
    notes: str | None = None
    virtual_link: str | None = None
    cancelled_by_id: UUID | None = None
    cancellation_reason: str | None = None
    reschedule_of_id: UUID | None = None
    scheduled_event_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MeetingListResponse(BaseModel):
    meetings: list[MeetingResponse]
    total: int
