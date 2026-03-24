"""Schemas for message digest preferences and preview."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MessageDigestPreferenceResponse(BaseModel):
    """Response schema for message digest preferences."""

    user_id: str
    digest_frequency: str = "daily"
    last_digest_sent_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MessageDigestPreferenceUpdate(BaseModel):
    """Update schema for message digest preferences."""

    digest_frequency: str = Field(
        ...,
        pattern=r"^(immediate|hourly|daily|weekly|never)$",
        description="Digest frequency: immediate, hourly, daily, weekly, or never",
    )


class DigestMessageSummary(BaseModel):
    """Summary of a single unread message within a digest."""

    message_id: str
    conversation_id: str
    conversation_title: str | None = None
    sender_name: str | None = None
    body_preview: str
    sent_at: datetime


class DigestPreviewResponse(BaseModel):
    """Preview of what the user's digest email would contain."""

    user_id: str
    unread_count: int
    messages: list[DigestMessageSummary]
    period_start: datetime | None = None
    period_end: datetime
