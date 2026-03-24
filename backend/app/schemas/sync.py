"""Schemas for multi-device sync operations."""

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user_preferences import UserPreferencesResponse


class SyncAction(StrEnum):
    """Types of sync actions."""

    MARK_READ = "mark_read"
    MARK_UNREAD = "mark_unread"
    UPDATE_PREFERENCE = "update_preference"
    UPDATE_UI_PREFERENCE = "update_ui_preference"


class EntityType(StrEnum):
    """Entity types that can be synced."""

    PROGRAM = "program"
    DOCUMENT = "document"
    DELIVERABLE = "deliverable"
    NOTIFICATION = "notification"
    TASK = "task"
    MESSAGE = "message"
    PREFERENCE = "preference"


class SyncChange(BaseModel):
    """A single change to be synced."""

    entity_type: str
    entity_id: UUID | None = None
    action: str
    payload: dict[str, Any] = Field(default_factory=dict)
    client_timestamp: datetime
    # Optional device ID (uses request-level device_id if not provided)
    device_id: str | None = None


class SyncPushRequest(BaseModel):
    """Request to push changes from client to server."""

    device_id: str
    changes: list[SyncChange]
    client_version: int
    # Last sync timestamp for incremental sync
    last_synced_at: datetime | None = None


class SyncPushResponse(BaseModel):
    """Response after pushing changes."""

    success: bool
    server_version: int
    processed_changes: int
    failed_changes: list[dict[str, Any]] | None = None
    synced_at: datetime


class ReadStatusResponse(BaseModel):
    """Read status for a single entity."""

    id: UUID
    user_id: UUID
    entity_type: str
    entity_id: UUID
    is_read: bool
    read_at: datetime | None = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReadStatusUpdate(BaseModel):
    """Request to update read status."""

    entity_type: str
    entity_id: UUID
    is_read: bool
    device_id: str | None = None


class BatchReadStatusUpdate(BaseModel):
    """Request to update read status for multiple entities."""

    updates: list[ReadStatusUpdate]


class SyncPullResponse(BaseModel):
    """Response for pulling changes from server."""

    server_version: int
    preferences: UserPreferencesResponse
    read_statuses: list[ReadStatusResponse]
    # Pending changes from other devices that haven't been synced
    pending_changes: list[SyncChange] | None = None
    synced_at: datetime


class DeviceSessionResponse(BaseModel):
    """Information about a device session."""

    id: UUID
    device_id: str
    device_type: str
    device_name: str | None = None
    last_seen_at: datetime
    is_active: bool
    app_version: str | None = None

    model_config = ConfigDict(from_attributes=True)


class DeviceRegisterRequest(BaseModel):
    """Request to register a device session."""

    device_id: str
    device_type: Literal["web", "ios", "android"]
    device_name: str | None = None
    user_agent: str | None = None
    app_version: str | None = None


class DeviceListResponse(BaseModel):
    """List of user's device sessions."""

    devices: list[DeviceSessionResponse]
    current_device_id: str | None = None
    total: int


class SyncStatusResponse(BaseModel):
    """Current sync status for the user."""

    is_syncing: bool
    last_synced_at: datetime | None = None
    pending_changes: int
    server_version: int
    sync_enabled: bool
    connected_devices: int
