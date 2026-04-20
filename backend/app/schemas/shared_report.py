"""Pydantic schemas for shared report links."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str50, Str100, Str255, Str500, Str2000


class SharedReportCreate(BaseModel):
    """Request body for creating a shareable report link."""

    report_type: Str50 = Field(
        ...,
        description=(
            "Report type: rm_portfolio, escalation_log, compliance, "
            "annual_review, portfolio, program_status, completion"
        ),
    )
    entity_id: Str100 | None = Field(
        None,
        description="program_id or year — required for program_status, completion, annual_review",
    )
    expires_in: Str50 = Field(
        default="never",
        description="Expiration window: 1d, 1w, 1m, or never",
    )
    password: Str255 | None = Field(None, description="Optional access password")
    allow_download: bool = Field(default=False, description="Allow recipients to download data")


class SharedReportResponse(BaseModel):
    """Full response returned after creating or listing a shared report."""

    id: UUID
    report_type: Str50
    entity_id: Str100 | None
    share_token: Str500
    created_by: UUID
    expires_at: datetime | None
    access_count: int
    is_active: bool
    allow_download: bool
    is_password_protected: bool
    share_url: Str2000
    creator_name: Str255 | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PublicReportAccessRequest(BaseModel):
    """Request body for accessing a password-protected shared report."""

    password: Str255 | None = None


class SharedReportMeta(BaseModel):
    """Public-facing metadata returned before access (no sensitive data)."""

    report_type: Str50
    entity_id: Str100 | None
    creator_name: Str255
    is_password_protected: bool
    allow_download: bool
    expires_at: datetime | None


class SharedReportPublicData(BaseModel):
    """Report data payload returned after successful access."""

    report_type: Str50
    entity_id: Str100 | None
    allow_download: bool
    data: dict[str, Any]
