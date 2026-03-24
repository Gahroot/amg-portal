"""Schemas for recent items."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RecentItemType(StrEnum):
    """Types of items that can be tracked as recent."""

    PROGRAM = "program"
    CLIENT = "client"
    PARTNER = "partner"
    DOCUMENT = "document"


class RecentItemBase(BaseModel):
    """Base schema for recent items."""

    item_type: RecentItemType
    item_id: UUID
    item_title: str = Field(..., max_length=255)
    item_subtitle: str | None = Field(None, max_length=255)


class RecentItemCreate(RecentItemBase):
    """Schema for creating a recent item."""

    pass


class RecentItemResponse(RecentItemBase):
    """Schema for recent item response."""

    id: UUID
    user_id: UUID
    viewed_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @property
    def url(self) -> str:
        """Generate the URL for the item based on its type."""
        base_urls = {
            RecentItemType.PROGRAM: "/programs",
            RecentItemType.CLIENT: "/clients",
            RecentItemType.PARTNER: "/partners",
            RecentItemType.DOCUMENT: "/documents",
        }
        return f"{base_urls[self.item_type]}/{self.item_id}"


class RecentItemListResponse(BaseModel):
    """Schema for list of recent items."""

    items: list[RecentItemResponse]
    total: int
