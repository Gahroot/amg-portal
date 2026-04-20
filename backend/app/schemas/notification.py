"""Schemas for notification operations."""

from datetime import datetime, time
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str100, Str255, Str500, TextStr


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    notification_type: Str50
    title: Str255
    body: TextStr
    action_url: Str500 | None = None
    action_label: Str255 | None = None
    entity_type: Str50 | None = None
    entity_id: UUID | None = None
    priority: Str50
    is_read: bool
    read_at: datetime | None = None
    email_delivered: bool
    group_key: Str255 | None = None
    created_at: datetime
    snoozed_until: datetime | None = None
    snooze_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class NotificationGroupResponse(BaseModel):
    """Response for a group of related notifications."""

    group_key: Str255
    group_label: Str255  # Human-readable label for the group
    notification_type: Str50  # Primary type for the group
    entity_type: Str50 | None = None
    entity_id: UUID | None = None
    priority: Str50  # Highest priority in group
    count: int
    unread_count: int
    is_read: bool  # True if all in group are read
    latest_created_at: datetime
    latest_title: Str255
    latest_body: TextStr
    action_url: Str500 | None = None
    action_label: Str255 | None = None
    notifications: list[NotificationResponse]


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int
    # Grouped view
    groups: list[NotificationGroupResponse] | None = None
    group_mode: Str50 | None = None  # "type", "entity", "time", or None (ungrouped)


class GroupedNotificationsResponse(BaseModel):
    """Response with notifications grouped by specified mode."""

    groups: list[NotificationGroupResponse]
    total_groups: int
    total_notifications: int
    group_mode: Str50  # "type", "entity", or "time"


class NotificationPreferenceUpdate(BaseModel):
    digest_enabled: bool | None = None
    digest_frequency: Str50 | None = None
    notification_type_preferences: dict[str, Any] | None = None
    channel_preferences: dict[str, Any] | None = None
    granular_preferences: dict[str, dict[str, bool]] | None = None
    quiet_hours_enabled: bool | None = None
    quiet_hours_start: time | None = None
    quiet_hours_end: time | None = None
    timezone: Str100 | None = None
    # Grouping preference: "type", "entity", "time", or None (ungrouped)
    grouping_mode: Str50 | None = None
    # Milestone reminder preferences
    milestone_reminder_days: list[int] | None = None
    milestone_reminder_channels: list[str] | None = None
    milestone_reminder_program_overrides: dict[str, Any] | None = None


class NotificationPreferenceResponse(BaseModel):
    id: UUID
    user_id: UUID
    digest_enabled: bool
    digest_frequency: Str50
    notification_type_preferences: dict[str, Any] | None = None
    channel_preferences: dict[str, Any] | None = None
    granular_preferences: dict[str, dict[str, bool]] | None = None
    quiet_hours_enabled: bool
    quiet_hours_start: time | None = None
    quiet_hours_end: time | None = None
    timezone: Str100
    grouping_mode: Str50 | None = None
    # Milestone reminder preferences
    milestone_reminder_days: list[int] | None = None
    milestone_reminder_channels: list[str] | None = None
    milestone_reminder_program_overrides: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CreateNotificationRequest(BaseModel):
    user_id: UUID
    notification_type: Str50
    title: Str255
    body: TextStr
    action_url: Str500 | None = None
    action_label: Str255 | None = None
    entity_type: Str50 | None = None
    entity_id: UUID | None = None
    priority: Str50 = "normal"
    # Optional override for group key; if not provided, will be auto-generated
    group_key: Str255 | None = None

    # Snooze preset option
    snooze_duration_minutes: int | None = None

    snooze_until: datetime | None = None


class SnoozeRequest(BaseModel):
    """Request to snooze a notification."""

    snooze_duration_minutes: int | None = None
    snooze_until: datetime | None = None

    def validate_snooze_options(self) -> None:
        if self.snooze_until is None and self.snooze_duration_minutes is None:
            raise ValueError("Either snooze_until or snooze_duration_minutes must required")
