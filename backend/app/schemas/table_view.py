"""Schemas for saved table views."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str100, Str255, Str500


class TableViewCreate(BaseModel):
    """Request to create a new saved table view."""

    table_id: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    filters: dict[str, Any] = Field(default_factory=dict)
    sort: list[dict[str, Any]] = Field(default_factory=list)
    columns: dict[str, bool] = Field(default_factory=dict)
    column_order: list[Str255] = Field(default_factory=list)
    column_sizes: dict[str, int] = Field(default_factory=dict)
    is_shared: bool = False
    is_default: bool = False


class TableViewUpdate(BaseModel):
    """Request to update an existing saved table view."""

    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    filters: dict[str, Any] | None = None
    sort: list[dict[str, Any]] | None = None
    columns: dict[str, bool] | None = None
    column_order: list[Str255] | None = None
    column_sizes: dict[str, int] | None = None
    is_shared: bool | None = None
    is_default: bool | None = None


class TableViewResponse(BaseModel):
    """Response for a saved table view."""

    id: UUID
    user_id: UUID
    table_id: Str100
    name: Str100
    description: Str500 | None
    filters: dict[str, Any]
    sort: list[dict[str, Any]]
    columns: dict[str, bool]
    column_order: list[Str255]
    column_sizes: dict[str, int]
    is_shared: bool
    is_default: bool
    created_at: datetime
    updated_at: datetime

    # Computed fields
    is_owner: bool = False
    created_by_name: Str255 | None = None

    model_config = ConfigDict(from_attributes=True)


class TableViewSummary(BaseModel):
    """Summary of a saved table view for list views."""

    id: UUID
    table_id: Str100
    name: Str100
    description: Str500 | None
    is_shared: bool
    is_default: bool
    is_owner: bool = False
    created_by_name: Str255 | None = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TableViewListResponse(BaseModel):
    """Response for listing saved table views."""

    items: list[TableViewSummary]
    total: int


class ApplyViewRequest(BaseModel):
    """Request to apply a saved view to current table state."""

    view_id: UUID


class SetDefaultViewRequest(BaseModel):
    """Request to set a view as default for a table."""

    table_id: Str100
