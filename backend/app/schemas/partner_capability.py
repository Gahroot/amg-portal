"""Schemas for partner capability matrix, qualifications, certifications, and onboarding."""

from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# Note: this file uses Field(max_length=...) inline rather than Str* aliases
# because column caps vary (Str200 isn't in app.schemas.base).


# Enums
class ProficiencyLevel(StrEnum):
    """Proficiency levels for capabilities."""

    beginner = "beginner"
    intermediate = "intermediate"
    expert = "expert"


class QualificationLevel(StrEnum):
    """Qualification levels for service categories."""

    qualified = "qualified"
    preferred = "preferred"
    expert = "expert"


class ApprovalStatus(StrEnum):
    """Approval status for qualifications."""

    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class CertificationStatus(StrEnum):
    """Verification status for certifications."""

    pending = "pending"
    verified = "verified"
    expired = "expired"
    rejected = "rejected"


class OnboardingStage(StrEnum):
    """Onboarding workflow stages."""

    profile_setup = "profile_setup"
    capability_matrix = "capability_matrix"
    compliance_docs = "compliance_docs"
    certification_upload = "certification_upload"
    review = "review"
    completed = "completed"


# Capability Schemas
class CapabilityCreate(BaseModel):
    """Schema for creating a partner capability."""

    capability_name: str = Field(..., max_length=100)
    proficiency_level: ProficiencyLevel
    years_experience: Decimal | None = Field(None, ge=0, le=99)
    notes: str | None = Field(None, max_length=2000)


class CapabilityUpdate(BaseModel):
    """Schema for updating a partner capability."""

    capability_name: str | None = Field(None, max_length=100)
    proficiency_level: ProficiencyLevel | None = None
    years_experience: Decimal | None = Field(None, ge=0, le=99)
    notes: str | None = Field(None, max_length=2000)


class CapabilityResponse(BaseModel):
    """Schema for capability response."""

    id: UUID
    partner_id: UUID
    capability_name: str = Field(..., max_length=100)
    proficiency_level: str = Field(..., max_length=50)
    years_experience: Decimal | None = None
    verified: bool = False
    verified_by: UUID | None = None
    verified_at: datetime | None = None
    notes: str | None = Field(None, max_length=2000)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CapabilityListResponse(BaseModel):
    """Schema for list of capabilities."""

    capabilities: list[CapabilityResponse]
    total: int


# Service Category Schemas
class ServiceCategoryCreate(BaseModel):
    """Schema for creating a service category."""

    name: str = Field(..., max_length=100)
    description: str | None = Field(None, max_length=2000)
    required_capabilities: list[str] = []


class ServiceCategoryUpdate(BaseModel):
    """Schema for updating a service category."""

    name: str | None = Field(None, max_length=100)
    description: str | None = Field(None, max_length=2000)
    required_capabilities: list[str] | None = None
    active: bool | None = None


class ServiceCategoryResponse(BaseModel):
    """Schema for service category response."""

    id: UUID
    name: str = Field(..., max_length=100)
    description: str | None = Field(None, max_length=2000)
    required_capabilities: list[str] = []
    active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ServiceCategoryListResponse(BaseModel):
    """Schema for list of service categories."""

    categories: list[ServiceCategoryResponse]
    total: int


# Qualification Schemas
class QualificationCreate(BaseModel):
    """Schema for creating a partner qualification."""

    category_id: UUID
    qualification_level: QualificationLevel
    notes: str | None = Field(None, max_length=2000)


class QualificationUpdate(BaseModel):
    """Schema for updating a partner qualification."""

    qualification_level: QualificationLevel | None = None
    notes: str | None = Field(None, max_length=2000)


class QualificationApproval(BaseModel):
    """Schema for approving/rejecting a qualification."""

    status: ApprovalStatus
    notes: str | None = Field(None, max_length=2000)


class QualificationResponse(BaseModel):
    """Schema for qualification response."""

    id: UUID
    partner_id: UUID
    category_id: UUID
    category_name: str | None = Field(None, max_length=100)
    qualification_level: str = Field(..., max_length=50)
    approval_status: str = Field(default="pending", max_length=50)
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    notes: str | None = Field(None, max_length=2000)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QualificationListResponse(BaseModel):
    """Schema for list of qualifications."""

    qualifications: list[QualificationResponse]
    total: int


# Certification Schemas
class CertificationCreate(BaseModel):
    """Schema for creating a partner certification."""

    name: str = Field(..., max_length=200)
    issuing_body: str = Field(..., max_length=200)
    certificate_number: str | None = Field(None, max_length=100)
    issue_date: date | None = None
    expiry_date: date | None = None
    document_url: str | None = Field(None, max_length=500)
    notes: str | None = Field(None, max_length=2000)


class CertificationUpdate(BaseModel):
    """Schema for updating a partner certification."""

    name: str | None = Field(None, max_length=200)
    issuing_body: str | None = Field(None, max_length=200)
    certificate_number: str | None = Field(None, max_length=100)
    issue_date: date | None = None
    expiry_date: date | None = None
    document_url: str | None = Field(None, max_length=500)
    notes: str | None = Field(None, max_length=2000)


class CertificationVerification(BaseModel):
    """Schema for verifying a certification."""

    status: CertificationStatus
    notes: str | None = Field(None, max_length=2000)


class CertificationResponse(BaseModel):
    """Schema for certification response."""

    id: UUID
    partner_id: UUID
    name: str = Field(..., max_length=200)
    issuing_body: str = Field(..., max_length=200)
    certificate_number: str | None = Field(None, max_length=100)
    issue_date: date | None = None
    expiry_date: date | None = None
    document_url: str | None = Field(None, max_length=500)
    verification_status: str = Field(default="pending", max_length=50)
    verified_by: UUID | None = None
    verified_at: datetime | None = None
    notes: str | None = Field(None, max_length=2000)
    created_at: datetime
    updated_at: datetime
    is_expired: bool = False
    is_expiring_soon: bool = False

    model_config = ConfigDict(from_attributes=True)


class CertificationListResponse(BaseModel):
    """Schema for list of certifications."""

    certifications: list[CertificationResponse]
    total: int


# Onboarding Schemas
class OnboardingCreate(BaseModel):
    """Schema for starting partner onboarding."""

    assigned_coordinator: UUID | None = None


class OnboardingUpdate(BaseModel):
    """Schema for updating onboarding progress."""

    current_stage: OnboardingStage | None = None
    checklist_items: dict[str, dict[str, bool]] | None = None
    completed_stages: list[str] | None = None
    assigned_coordinator: UUID | None = None


class OnboardingStageComplete(BaseModel):
    """Schema for completing an onboarding stage."""

    stage: OnboardingStage
    checklist_items: dict[str, bool] | None = None


class OnboardingResponse(BaseModel):
    """Schema for onboarding response."""

    id: UUID
    partner_id: UUID
    current_stage: str = Field(default="initial", max_length=50)
    checklist_items: dict[str, dict[str, bool]] | dict[str, Any] = {}
    completed_stages: list[str] = []
    assigned_coordinator: UUID | None = None
    coordinator_name: str | None = Field(None, max_length=255)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    progress_percentage: int = 0

    model_config = ConfigDict(from_attributes=True)


# Full Capability Matrix Response
class CapabilityMatrixResponse(BaseModel):
    """Full capability matrix for a partner."""

    partner_id: UUID
    firm_name: str = Field(..., max_length=255)
    capabilities: list[CapabilityResponse] = []
    qualifications: list[QualificationResponse] = []
    certifications: list[CertificationResponse] = []
    onboarding: OnboardingResponse | None = None
    capability_summary: dict[str, int] = {}  # {beginner: X, intermediate: Y, expert: Z}
    qualification_summary: dict[str, int] = {}  # {approved: X, pending: Y, rejected: Z}
