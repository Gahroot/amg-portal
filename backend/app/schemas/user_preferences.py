"""Schemas for user preferences operations."""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str50
from app.schemas.notification import NotificationPreferenceResponse


class UIPreferences(BaseModel):
    """User interface preferences.

    These control the appearance and behavior of the UI across all devices.
    """

    theme: Literal["light", "dark", "system"] = "system"
    sidebar_collapsed: bool = False
    density: Literal["comfortable", "compact"] = "comfortable"
    # Additional UI preferences can be added here
    language: Str50 = "en"
    date_format: Str50 = "MM/DD/YYYY"
    time_format: Literal["12h", "24h"] = "12h"
    # Per-page preferences
    page_sizes: dict[str, int] = Field(default_factory=lambda: {})
    # Column visibility preferences per table
    column_visibility: dict[str, dict[str, bool]] = Field(default_factory=lambda: {})


class UIPreferencesUpdate(BaseModel):
    """Update request for UI preferences."""

    theme: Literal["light", "dark", "system"] | None = None
    sidebar_collapsed: bool | None = None
    density: Literal["comfortable", "compact"] | None = None
    language: Str50 | None = None
    date_format: Str50 | None = None
    time_format: Literal["12h", "24h"] | None = None
    page_sizes: dict[str, int] | None = None
    column_visibility: dict[str, dict[str, bool]] | None = None


class DashboardConfigSummary(BaseModel):
    """Summary of dashboard configuration for sync."""

    layout_mode: Str50 = "grid"
    columns: int = 3
    widgets: list[dict[str, Any]] = Field(default_factory=list)


class UserPreferencesResponse(BaseModel):
    """Full user preferences response including all preference types."""

    id: UUID
    user_id: UUID
    ui_preferences: UIPreferences
    notification_preferences: NotificationPreferenceResponse | None = None
    dashboard_config: DashboardConfigSummary | None = None
    sync_enabled: bool
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserPreferencesUpdate(BaseModel):
    """Update request for user preferences with optimistic locking."""

    ui_preferences: UIPreferencesUpdate | None = None
    sync_enabled: bool | None = None
    # Version for optimistic locking - must match current server version
    version: int


class ConflictResolution(BaseModel):
    """Information about a detected conflict and how to resolve it."""

    server_version: int
    client_version: int
    server_updated_at: datetime
    conflict_fields: list[Str50]
    resolution_strategy: Literal["server_wins", "client_wins", "merge"] = "server_wins"


class UserPreferencesSyncResponse(BaseModel):
    """Response for preferences sync operation."""

    preferences: UserPreferencesResponse
    conflict: ConflictResolution | None = None
    synced_at: datetime
