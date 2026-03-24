"""Pydantic schemas for document sharing."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class DocumentShareCreate(BaseModel):
    """Request body for creating a document share."""
    shared_with_email: EmailStr
    access_level: str = "view"  # view or download
    expires_hours: int = 72  # default 3 days


class DocumentShareResponse(BaseModel):
    """Response schema for a document share record."""
    id: UUID
    document_id: UUID
    shared_by: UUID
    shared_with_email: str
    access_level: str
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
    verification_code: str


class DocumentShareAccessResponse(BaseModel):
    """Response after successful OTP verification — provides view URL."""
    share_id: UUID
    document_id: UUID
    file_name: str
    view_url: str
    access_level: str
    expires_at: datetime | None
    message: str = "Access granted"
