"""Schemas for scheduled event operations."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str100, Str255, Str500, Str2000


class ScheduledEventCreate(BaseModel):
    title: Str255
    description: Str2000 | None = None
    event_type: Str50
    start_time: datetime
    end_time: datetime
    timezone: Str100 = "UTC"
    location: Str500 | None = None
    virtual_link: Str500 | None = None
    program_id: UUID | None = None
    client_id: UUID | None = None
    attendee_ids: list[UUID] | None = None
    recurrence_rule: Str500 | None = None
    reminder_minutes: int = 30
    notes: Str2000 | None = None


class ScheduledEventUpdate(BaseModel):
    title: Str255 | None = None
    description: Str2000 | None = None
    event_type: Str50 | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    timezone: Str100 | None = None
    location: Str500 | None = None
    virtual_link: Str500 | None = None
    program_id: UUID | None = None
    client_id: UUID | None = None
    attendee_ids: list[UUID] | None = None
    status: Str50 | None = None
    recurrence_rule: Str500 | None = None
    reminder_minutes: int | None = None
    notes: Str2000 | None = None


class ScheduledEventResponse(BaseModel):
    id: UUID
    title: Str255
    description: Str2000 | None = None
    event_type: Str50
    start_time: datetime
    end_time: datetime
    timezone: Str100
    location: Str500 | None = None
    virtual_link: Str500 | None = None
    organizer_id: UUID
    program_id: UUID | None = None
    client_id: UUID | None = None
    attendee_ids: list[UUID] | None = None
    status: Str50
    recurrence_rule: Str500 | None = None
    reminder_minutes: int
    notes: Str2000 | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScheduledEventListResponse(BaseModel):
    events: list[ScheduledEventResponse]
    total: int


class ConflictCheckResponse(BaseModel):
    has_conflicts: bool
    conflicts: list[ScheduledEventResponse]


class StatusUpdateRequest(BaseModel):
    status: Str50
