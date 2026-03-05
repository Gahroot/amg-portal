"""Schemas for notification operations."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    notification_type: str
    title: str
    body: str
    action_url: str | None = None
    action_label: str | None = None
    entity_type: str | None = None
    entity_id: UUID | None = None
    priority: str
    is_read: bool
    read_at: datetime | None = None
    email_delivered: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int


class NotificationPreferenceUpdate(BaseModel):
    digest_enabled: bool | None = None
    digest_frequency: str | None = None
    notification_type_preferences: dict[str, Any] | None = None
    channel_preferences: dict[str, Any] | None = None


class NotificationPreferenceResponse(BaseModel):
    id: UUID
    user_id: UUID
    digest_enabled: bool
    digest_frequency: str
    notification_type_preferences: dict[str, Any] | None = None
    channel_preferences: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CreateNotificationRequest(BaseModel):
    user_id: UUID
    notification_type: str
    title: str
    body: str
    action_url: str | None = None
    action_label: str | None = None
    entity_type: str | None = None
    entity_id: UUID | None = None
    priority: str = "normal"
