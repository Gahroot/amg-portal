"""Pydantic schemas for document sharing."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.schemas.base import Str50, Str100, Str255, Str2000


class DocumentShareCreate(BaseModel):
    """Request body for creating a document share."""

    shared_with_email: EmailStr
    access_level: Str50 = "view"  # view or download
    expires_hours: int = 72  # default 3 days


class DocumentShareResponse(BaseModel):
    """Response schema for a document share record."""

    id: UUID
    document_id: UUID
    shared_by: UUID
    shared_with_email: Str255
    access_level: Str50
    expires_at: datetime | None
    access_count: int
    is_active: bool
    revoked_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentShareListResponse(BaseModel):
    shares: list[DocumentShareResponse]
    total: int


class DocumentShareVerifyRequest(BaseModel):
    """OTP verification request from the recipient."""

    verification_code: Str100


class DocumentShareAccessResponse(BaseModel):
    """Response after successful OTP verification — provides view URL."""

    share_id: UUID
    document_id: UUID
    file_name: Str255
    view_url: Str2000
    access_level: Str50
    expires_at: datetime | None
    message: Str255 = "Access granted"
