"""Pydantic schemas for compliance clearance certificates."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

# ============================================================================
# Certificate Template Schemas
# ============================================================================

class CertificateTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    template_type: str = Field(..., pattern="^(program|client|partner)$")
    content: str = Field(..., min_length=1)
    placeholders: dict | None = None
    is_active: bool = True


class CertificateTemplateUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    content: str | None = Field(None, min_length=1)
    placeholders: dict | None = None
    is_active: bool | None = None


class CertificateTemplateResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    template_type: str
    content: str
    placeholders: dict | None
    is_active: bool
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


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
    content: str | None = None  # If not provided, will be generated from template
    certificate_type: str = Field(..., min_length=1, max_length=50)
    issue_date: date | None = None
    expiry_date: date | None = None


class ClearanceCertificateUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    content: str | None = None
    issue_date: date | None = None
    expiry_date: date | None = None
    status: str | None = Field(None, pattern="^(draft|issued|revoked|expired)$")


class ClearanceCertificateIssue(BaseModel):
    issue_date: date | None = None
    expiry_date: date | None = None
    review_notes: str | None = None


class ClearanceCertificateRevoke(BaseModel):
    reason: str = Field(..., min_length=1)


class ClearanceCertificateHistoryResponse(BaseModel):
    id: UUID
    certificate_id: UUID
    action: str
    from_status: str | None
    to_status: str | None
    actor_id: UUID
    actor_name: str
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ClearanceCertificateResponse(BaseModel):
    id: UUID
    certificate_number: str
    template_id: UUID | None
    template_name: str | None = None
    program_id: UUID | None
    program_title: str | None = None
    client_id: UUID
    client_name: str = ""
    title: str
    content: str
    populated_data: dict | None
    certificate_type: str
    status: str
    issue_date: date | None
    expiry_date: date | None
    reviewed_by: UUID | None
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None
    review_notes: str | None
    pdf_path: str | None
    download_url: str | None = None
    created_by: UUID
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


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
    program_title: str
    program_status: str
    client_id: UUID
    client_name: str
    client_legal_name: str | None
    start_date: date | None
    end_date: date | None
    objectives: str | None
    scope: str | None
    budget_envelope: Decimal | None
    total_milestones: int
    completed_milestones: int
    total_deliverables: int
    approved_deliverables: int
    assigned_partners: list[dict]
    completion_date: date | None = None


class CertificatePreviewRequest(BaseModel):
    """Request to preview certificate with auto-populated data."""
    template_id: UUID | None = None
    program_id: UUID | None = None
    client_id: UUID
    certificate_type: str
    title: str | None = None
    custom_content: str | None = None


class CertificatePreviewResponse(BaseModel):
    """Preview of certificate content before generation."""
    title: str
    content: str
    populated_data: dict
    available_placeholders: list[str]
