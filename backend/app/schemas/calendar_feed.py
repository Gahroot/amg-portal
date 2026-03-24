"""Pydantic schemas for calendar feed token management."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CalendarFeedTokenCreate(BaseModel):
    """Request body for creating a new calendar feed token."""

    name: str = Field(
        default="Calendar Feed",
        max_length=100,
        description="A descriptive name for the calendar feed",
    )


class CalendarFeedTokenResponse(BaseModel):
    """Response for a calendar feed token (without the actual token for list views)."""

    id: UUID
    name: str
    is_active: bool
    last_accessed_at: datetime | None = None
    created_at: datetime
    revoked_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CalendarFeedTokenCreatedResponse(CalendarFeedTokenResponse):
    """Response when a feed token is first created (includes the full URL)."""

    feed_url: str = Field(description="The full iCal subscription URL")
    token: str = Field(description="The feed token (shown only once!)")
    warning: str = Field(
        default="This is the only time you will see the full URL. Store it securely!",
        description="Warning about URL visibility",
    )


class CalendarFeedStatusResponse(BaseModel):
    """Response for calendar feed status."""

    has_active_token: bool
    active_token: CalendarFeedTokenResponse | None = None
    feed_url: str | None = Field(default=None, description="The feed URL (only if token exists)")


class CalendarFeedFilterOptions(BaseModel):
    """Options for filtering calendar feed content."""

    include_milestones: bool = Field(default=True, description="Include program milestones")
    include_deadlines: bool = Field(default=True, description="Include decision deadlines")
    include_meetings: bool = Field(default=True, description="Include scheduled meetings")
    days_ahead: int | None = Field(
        default=90,
        ge=1,
        le=365,
        description="Number of days ahead to include (null = all future)",
    )
