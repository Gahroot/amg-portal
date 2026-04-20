"""Pydantic schemas for KYC verification workflow."""

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.base import Str50, Str255, Str500, Str2000

# === KYC Check Schemas ===


class KYCCheckBase(BaseModel):
    check_type: str = Field(..., max_length=30)
    provider: str | None = Field(None, max_length=100)
    external_reference: str | None = Field(None, max_length=255)
    notes: Str2000 | None = None


class KYCCheckCreate(KYCCheckBase):
    pass


class KYCCheckUpdate(BaseModel):
    status: str | None = Field(None, max_length=20)
    result_data: dict[str, Any] | None = None
    risk_score: int | None = Field(None, ge=0, le=100)
    match_details: dict[str, Any] | None = None
    notes: Str2000 | None = None


class KYCCheckResponse(KYCCheckBase):
    id: UUID
    verification_id: UUID
    status: Str50
    result_data: dict[str, Any] | None = None
    risk_score: int | None = None
    match_details: dict[str, Any] | None = None
    checked_at: datetime | None = None
    checked_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class KYCCheckListResponse(BaseModel):
    checks: list[KYCCheckResponse]
    total: int


# === KYC Verification Schemas ===


class KYCVerificationBase(BaseModel):
    verification_type: str = Field(default="standard", max_length=20)
    notes: Str2000 | None = None


class KYCVerificationCreate(KYCVerificationBase):
    client_id: UUID


class KYCVerificationUpdate(BaseModel):
    verification_type: str | None = Field(None, max_length=20)
    risk_level: str | None = Field(None, max_length=20)
    risk_assessment: dict[str, Any] | None = None
    review_notes: Str2000 | None = None
    notes: Str2000 | None = None
    expires_at: date | None = None


class KYCVerificationResponse(BaseModel):
    id: UUID
    client_id: UUID
    status: Str50
    verification_type: Str50
    risk_level: Str50 | None = None
    risk_assessment: dict[str, Any] | None = None
    submitted_at: datetime | None = None
    completed_at: datetime | None = None
    expires_at: date | None = None
    reviewed_by: UUID | None = None
    review_notes: Str2000 | None = None
    notes: Str2000 | None = None
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    checks: list[KYCCheckResponse] = []

    model_config = {"from_attributes": True}


class KYCVerificationListResponse(BaseModel):
    verifications: list[KYCVerificationResponse]
    total: int


class KYCVerificationSummary(BaseModel):
    """Dashboard summary of KYC verifications."""

    total_clients: int
    draft: int
    pending: int
    in_progress: int
    verified: int
    rejected: int
    expired: int
    expiring_soon: int
    high_risk: int
    critical_risk: int


class KYCClientStatus(BaseModel):
    """Client's overall KYC status."""

    client_id: UUID
    client_name: Str255
    has_verification: bool
    verification_status: Str50 | None = None
    verification_type: Str50 | None = None
    risk_level: Str50 | None = None
    verified_at: datetime | None = None
    expires_at: date | None = None
    days_until_expiry: int | None = None
    documents_count: int = 0
    documents_verified: int = 0
    pending_checks: int = 0
    failed_checks: int = 0


# === KYC Alert Schemas ===


class KYCAlertBase(BaseModel):
    alert_type: str = Field(..., max_length=30)
    severity: str = Field(default="warning", max_length=20)
    title: str = Field(..., max_length=255)
    message: Str2000
    metadata: dict[str, Any] | None = None


class KYCAlertCreate(KYCAlertBase):
    client_id: UUID
    verification_id: UUID | None = None
    kyc_document_id: UUID | None = None


class KYCAlertUpdate(BaseModel):
    is_read: bool | None = None
    resolution_notes: Str2000 | None = None


class KYCAlertResponse(KYCAlertBase):
    id: UUID
    client_id: UUID
    verification_id: UUID | None = None
    kyc_document_id: UUID | None = None
    is_read: bool
    is_resolved: bool
    resolved_by: UUID | None = None
    resolved_at: datetime | None = None
    resolution_notes: Str2000 | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class KYCAlertListResponse(BaseModel):
    alerts: list[KYCAlertResponse]
    total: int
    unread_count: int


# === KYC Report Schemas ===


class KYCReportBase(BaseModel):
    report_type: str = Field(..., max_length=30)
    title: str = Field(..., max_length=255)
    period_start: date | None = None
    period_end: date | None = None


class KYCReportCreate(KYCReportBase):
    client_id: UUID | None = None
    verification_id: UUID | None = None


class KYCReportResponse(KYCReportBase):
    id: UUID
    client_id: UUID | None = None
    verification_id: UUID | None = None
    status: Str50
    file_path: Str500 | None = None
    file_name: Str255 | None = None
    summary: dict[str, Any] | None = None
    generated_at: datetime | None = None
    generated_by: UUID | None = None
    error_message: Str2000 | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class KYCReportListResponse(BaseModel):
    reports: list[KYCReportResponse]
    total: int


# === Combined Dashboard Response ===


class KYCDashboardResponse(BaseModel):
    """Complete KYC dashboard data."""

    summary: KYCVerificationSummary
    recent_alerts: list[KYCAlertResponse]
    pending_verifications: list[KYCVerificationResponse]
    expiring_soon: list[KYCClientStatus]
