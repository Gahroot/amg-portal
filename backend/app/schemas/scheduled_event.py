"""Schemas for scheduled event operations."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ScheduledEventCreate(BaseModel):
    title: str
    description: str | None = None
    event_type: str
    start_time: datetime
    end_time: datetime
    timezone: str = "UTC"
    location: str | None = None
    virtual_link: str | None = None
    program_id: UUID | None = None
    client_id: UUID | None = None
    attendee_ids: list[UUID] | None = None
    recurrence_rule: str | None = None
    reminder_minutes: int = 30
    notes: str | None = None


class ScheduledEventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    event_type: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    timezone: str | None = None
    location: str | None = None
    virtual_link: str | None = None
    program_id: UUID | None = None
    client_id: UUID | None = None
    attendee_ids: list[UUID] | None = None
    status: str | None = None
    recurrence_rule: str | None = None
    reminder_minutes: int | None = None
    notes: str | None = None


class ScheduledEventResponse(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    event_type: str
    start_time: datetime
    end_time: datetime
    timezone: str
    location: str | None = None
    virtual_link: str | None = None
    organizer_id: UUID
    program_id: UUID | None = None
    client_id: UUID | None = None
    attendee_ids: list[UUID] | None = None
    status: str
    recurrence_rule: str | None = None
    reminder_minutes: int
    notes: str | None = None
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
    status: str
