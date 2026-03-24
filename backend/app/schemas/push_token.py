"""Schemas for push token operations."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


class PushTokenRegisterRequest(BaseModel):
    token: str
    platform: str  # ios, android, web
    device_name: str | None = None

    @field_validator("platform")
    @classmethod
    def validate_platform(cls, v: str) -> str:
        v = v.lower()
        if v not in ("ios", "android", "web"):
            raise ValueError("Platform must be ios, android, or web")
        return v


class PushTokenResponse(BaseModel):
    id: UUID
    user_id: UUID
    token: str
    platform: str
    device_name: str | None = None
    is_active: bool
    last_used_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PushTokenListResponse(BaseModel):
    tokens: list[PushTokenResponse]
    total: int
