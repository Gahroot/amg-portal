"""Dashboard widget configuration schemas."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class WidgetConfigItem(BaseModel):
    """Configuration for a single widget instance."""

    widget_id: str  # The type ID from the registry (e.g., "programs-overview")
    instance_id: str  # Unique ID for this instance (allows duplicates)
    size: str = "medium"  # "small", "medium", "large"
    position: int  # Order position in the grid
    config: dict[str, Any] | None = None  # Widget-specific configuration


class DashboardConfigResponse(BaseModel):
    """Response for user's dashboard configuration."""

    id: UUID
    user_id: UUID
    widgets: list[WidgetConfigItem]
    layout_mode: str = "grid"  # "grid" or "flex"
    columns: int = 2  # Number of columns in grid layout

    model_config = ConfigDict(from_attributes=True)


class DashboardConfigUpdate(BaseModel):
    """Request to update dashboard configuration."""

    widgets: list[WidgetConfigItem] | None = None
    layout_mode: str | None = None
    columns: int | None = None


class WidgetConfigUpdate(BaseModel):
    """Request to update a single widget's configuration."""

    size: str | None = None
    position: int | None = None
    config: dict[str, Any] | None = None
