"""Schemas for push token operations."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.base import Str50, Str255, Str500


class PushTokenRegisterRequest(BaseModel):
    token: Str500
    platform: Str50  # ios, android, web
    device_name: Str255 | None = None

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
    token: Str500
    platform: Str50
    device_name: Str255 | None = None
    is_active: bool
    last_used_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PushTokenListResponse(BaseModel):
    tokens: list[PushTokenResponse]
    total: int
