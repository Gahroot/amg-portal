"""Pydantic schemas for compliance clearance certificates."""

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str50, Str100, Str255, Str500, Str2000, TextStr

# ============================================================================
# Certificate Template Schemas
# ============================================================================


class CertificateTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Str2000 | None = None
    template_type: str = Field(..., pattern="^(program|client|partner)$")
    content: TextStr = Field(..., min_length=1)
    placeholders: dict[str, Any] | None = None
    is_active: bool = True


class CertificateTemplateUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: Str2000 | None = None
    content: TextStr | None = Field(None, min_length=1)
    placeholders: dict[str, Any] | None = None
    is_active: bool | None = None


class CertificateTemplateResponse(BaseModel):
    id: UUID
    name: Str255
    description: Str2000 | None
    template_type: Str50
    content: TextStr
    placeholders: dict[str, Any] | None
    is_active: bool
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CertificateTemplateListResponse(BaseModel):
    templates: list[CertificateTemplateResponse]
    total: int


# ============================================================================
# Clearance Certificate Schemas
# ============================================================================


class ClearanceCertificateCreate(BaseModel):
    template_id: UUID | None = None
    program_id: UUID | None = None
    client_id: UUID
    title: str = Field(..., min_length=1, max_length=255)
    content: TextStr | None = None  # If not provided, will be generated from template
    certificate_type: str = Field(..., min_length=1, max_length=50)
    issue_date: date | None = None
    expiry_date: date | None = None


class ClearanceCertificateUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    content: TextStr | None = None
    issue_date: date | None = None
    expiry_date: date | None = None
    status: str | None = Field(None, pattern="^(draft|issued|revoked|expired)$")


class ClearanceCertificateIssue(BaseModel):
    issue_date: date | None = None
    expiry_date: date | None = None
    review_notes: Str2000 | None = None


class ClearanceCertificateRevoke(BaseModel):
    reason: str = Field(..., min_length=1, max_length=2000)


class ClearanceCertificateHistoryResponse(BaseModel):
    id: UUID
    certificate_id: UUID
    action: Str50
    from_status: Str50 | None
    to_status: Str50 | None
    actor_id: UUID
    actor_name: Str255
    notes: Str2000 | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClearanceCertificateResponse(BaseModel):
    id: UUID
    certificate_number: Str100
    template_id: UUID | None
    template_name: Str255 | None = None
    program_id: UUID | None
    program_title: Str255 | None = None
    client_id: UUID
    client_name: Str255 = ""
    title: Str255
    content: TextStr
    populated_data: dict[str, Any] | None
    certificate_type: Str50
    status: Str50
    issue_date: date | None
    expiry_date: date | None
    reviewed_by: UUID | None
    reviewed_by_name: Str255 | None = None
    reviewed_at: datetime | None
    review_notes: Str2000 | None
    pdf_path: Str500 | None
    download_url: Str2000 | None = None
    created_by: UUID
    created_by_name: Str255 | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClearanceCertificateListResponse(BaseModel):
    certificates: list[ClearanceCertificateResponse]
    total: int


class ClearanceCertificateDetailResponse(ClearanceCertificateResponse):
    history: list[ClearanceCertificateHistoryResponse] = []


# ============================================================================
# Auto-populate Schemas
# ============================================================================


class ProgramDataForCertificate(BaseModel):
    """Data extracted from program for certificate auto-population."""

    program_id: UUID
    program_title: Str255
    program_status: Str50
    client_id: UUID
    client_name: Str255
    client_legal_name: Str255 | None
    start_date: date | None
    end_date: date | None
    objectives: Str2000 | None
    scope: Str2000 | None
    budget_envelope: Decimal | None
    total_milestones: int
    completed_milestones: int
    total_deliverables: int
    approved_deliverables: int
    assigned_partners: list[dict[str, Any]]
    completion_date: date | None = None


class CertificatePreviewRequest(BaseModel):
    """Request to preview certificate with auto-populated data."""

    template_id: UUID | None = None
    program_id: UUID | None = None
    client_id: UUID
    certificate_type: Str50
    title: Str255 | None = None
    custom_content: TextStr | None = None


class CertificatePreviewResponse(BaseModel):
    """Preview of certificate content before generation."""

    title: Str255
    content: TextStr
    populated_data: dict[str, Any]
    available_placeholders: list[str]
