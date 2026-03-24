"""Schemas for bookmarks (pinned programs, clients, partners)."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field


class BookmarkEntityType(StrEnum):
    """Entity types that can be bookmarked."""

    PROGRAM = "program"
    CLIENT = "client"
    PARTNER = "partner"


_ENTITY_BASE_URLS: dict[BookmarkEntityType, str] = {
    BookmarkEntityType.PROGRAM: "/programs",
    BookmarkEntityType.CLIENT: "/clients",
    BookmarkEntityType.PARTNER: "/partners",
}


class BookmarkCreate(BaseModel):
    """Schema for creating a bookmark."""

    entity_type: BookmarkEntityType
    entity_id: UUID
    entity_title: str = Field(..., max_length=255)
    entity_subtitle: str | None = Field(None, max_length=255)


class BookmarkResponse(BaseModel):
    """Schema for a bookmark in API responses."""

    id: UUID
    user_id: UUID
    entity_type: BookmarkEntityType
    entity_id: UUID
    entity_title: str
    entity_subtitle: str | None
    display_order: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def url(self) -> str:
        """Frontend navigation URL for the bookmarked entity."""
        return f"{_ENTITY_BASE_URLS[self.entity_type]}/{self.entity_id}"


class BookmarkListResponse(BaseModel):
    """Schema for list of bookmarks."""

    items: list[BookmarkResponse]
    total: int
