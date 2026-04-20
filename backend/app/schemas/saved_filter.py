"""Schemas for saved filter presets."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str100


class SavedFilterEntityType(StrEnum):
    """Entity types that support saved filters."""

    PROGRAMS = "programs"
    CLIENTS = "clients"
    PARTNERS = "partners"
    COMMUNICATION_LOGS = "communication_logs"


class SavedFilterCreate(BaseModel):
    """Schema for creating a saved filter."""

    name: str = Field(..., min_length=1, max_length=100)
    entity_type: SavedFilterEntityType
    filter_config: dict[str, Any]
    is_default: bool = False


class SavedFilterUpdate(BaseModel):
    """Schema for updating a saved filter."""

    name: str | None = Field(None, min_length=1, max_length=100)
    filter_config: dict[str, Any] | None = None
    is_default: bool | None = None


class SavedFilterResponse(BaseModel):
    """Schema for saved filter response."""

    id: UUID
    user_id: UUID
    name: Str100
    entity_type: SavedFilterEntityType
    filter_config: dict[str, Any]
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SavedFilterListResponse(BaseModel):
    """Schema for list of saved filters."""

    items: list[SavedFilterResponse]
    total: int
