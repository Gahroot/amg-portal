"""Pydantic schemas for calendar integration API."""

import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from app.models.enums import CalendarProvider


class OAuthAuthorizeRequest(BaseModel):
    """Request to initiate OAuth flow for calendar connection."""

    provider: CalendarProvider
    redirect_uri: str


class OAuthAuthorizeResponse(BaseModel):
    """Response with OAuth authorization URL."""

    authorization_url: str
    state: str


class OAuthCallbackRequest(BaseModel):
    """OAuth callback with authorization code."""

    provider: CalendarProvider
    code: str
    state: str
    redirect_uri: str


class CalendarConnectionCreate(BaseModel):
    """Create a new calendar connection (internal use after OAuth)."""

    provider: CalendarProvider
    access_token: str
    refresh_token: str | None = None
    token_expires_at: datetime | None = None
    calendar_id: str | None = None
    calendar_name: str | None = None
    is_primary: bool = False
    sync_milestones: bool = True
    sync_tasks: bool = False
    reminder_minutes: int | None = None


class CalendarConnectionUpdate(BaseModel):
    """Update calendar connection settings."""

    calendar_id: str | None = None
    calendar_name: str | None = None
    is_primary: bool | None = None
    is_active: bool | None = None
    sync_milestones: bool | None = None
    sync_tasks: bool | None = None
    reminder_minutes: int | None = None


class CalendarConnectionResponse(BaseModel):
    """Calendar connection response."""

    id: uuid.UUID
    provider: str
    provider_email: str | None
    calendar_id: str | None
    calendar_name: str | None
    is_primary: bool
    is_active: bool
    sync_milestones: bool
    sync_tasks: bool
    reminder_minutes: int | None
    last_sync_at: datetime | None
    sync_error: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CalendarListResponse(BaseModel):
    """List of available calendars from a provider."""

    calendars: list[dict[str, str | bool]]


class SyncMilestoneRequest(BaseModel):
    """Request to sync a milestone to calendar."""

    connection_id: uuid.UUID
    event_title: str | None = None
    event_description: str | None = None
    reminder_minutes: int | None = Field(default=None, ge=0)


class SyncMilestoneResponse(BaseModel):
    """Response after syncing a milestone."""

    calendar_event_id: uuid.UUID
    external_event_id: str
    event_url: str | None
    status: str


class CalendarEventResponse(BaseModel):
    """Calendar event details."""

    id: uuid.UUID
    connection_id: uuid.UUID
    milestone_id: uuid.UUID
    external_event_id: str
    event_url: str | None
    status: str
    last_synced_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class CalendarReminderCreate(BaseModel):
    """Create a reminder for a milestone."""

    reminder_minutes: int = Field(..., ge=0, description="Minutes before due date to send reminder")


class CalendarReminderResponse(BaseModel):
    """Calendar reminder details."""

    id: uuid.UUID
    milestone_id: uuid.UUID
    user_id: uuid.UUID
    reminder_minutes: int
    notification_sent: bool
    notification_sent_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AvailabilityRequest(BaseModel):
    """Request to check user availability."""

    user_ids: list[uuid.UUID]
    start_time: datetime
    end_time: datetime


class TimeSlot(StrEnum):
    """Time slot availability status."""

    free = "free"
    busy = "busy"
    tentative = "tentative"
    unknown = "unknown"


class AvailabilitySlot(BaseModel):
    """A time slot with availability status."""

    start_time: datetime
    end_time: datetime
    status: TimeSlot


class UserAvailabilityResponse(BaseModel):
    """Availability for a user."""

    user_id: uuid.UUID
    user_name: str | None
    slots: list[AvailabilitySlot]
    has_calendar: bool


class AvailabilityResponse(BaseModel):
    """Availability check response for multiple users."""

    start_time: datetime
    end_time: datetime
    users: list[UserAvailabilityResponse]


class BatchSyncRequest(BaseModel):
    """Request to sync multiple milestones."""

    milestone_ids: list[uuid.UUID]
    connection_id: uuid.UUID


class BatchSyncResponse(BaseModel):
    """Response from batch sync operation."""

    synced: list[uuid.UUID]
    failed: list[dict[str, str]]  # {milestone_id: error_message}


class SyncStatusResponse(BaseModel):
    """Sync status for a milestone."""

    milestone_id: uuid.UUID
    is_synced: bool
    calendar_events: list[CalendarEventResponse]
    reminders: list[CalendarReminderResponse]
