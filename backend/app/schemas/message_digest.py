"""Schemas for message digest preferences and preview."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str50, Str100, Str255, Str500


class MessageDigestPreferenceResponse(BaseModel):
    """Response schema for message digest preferences."""

    user_id: Str100
    digest_frequency: Str50 = "daily"
    last_digest_sent_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MessageDigestPreferenceUpdate(BaseModel):
    """Update schema for message digest preferences."""

    digest_frequency: str = Field(
        ...,
        max_length=50,
        pattern=r"^(immediate|hourly|daily|weekly|never)$",
        description="Digest frequency: immediate, hourly, daily, weekly, or never",
    )


class DigestMessageSummary(BaseModel):
    """Summary of a single unread message within a digest."""

    message_id: Str100
    conversation_id: Str100
    conversation_title: Str255 | None = None
    sender_name: Str255 | None = None
    body_preview: Str500
    sent_at: datetime


class DigestPreviewResponse(BaseModel):
    """Preview of what the user's digest email would contain."""

    user_id: Str100
    unread_count: int
    messages: list[DigestMessageSummary]
    period_start: datetime | None = None
    period_end: datetime
