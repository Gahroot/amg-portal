"""Schemas for partner capability matrix, qualifications, certifications, and onboarding."""

from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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
    notes: str | None = None


class CapabilityUpdate(BaseModel):
    """Schema for updating a partner capability."""

    capability_name: str | None = Field(None, max_length=100)
    proficiency_level: ProficiencyLevel | None = None
    years_experience: Decimal | None = Field(None, ge=0, le=99)
    notes: str | None = None


class CapabilityResponse(BaseModel):
    """Schema for capability response."""

    id: UUID
    partner_id: UUID
    capability_name: str
    proficiency_level: str
    years_experience: Decimal | None = None
    verified: bool
    verified_by: UUID | None = None
    verified_at: datetime | None = None
    notes: str | None = None
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
    description: str | None = None
    required_capabilities: list[str] = []


class ServiceCategoryUpdate(BaseModel):
    """Schema for updating a service category."""

    name: str | None = Field(None, max_length=100)
    description: str | None = None
    required_capabilities: list[str] | None = None
    active: bool | None = None


class ServiceCategoryResponse(BaseModel):
    """Schema for service category response."""

    id: UUID
    name: str
    description: str | None = None
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
    notes: str | None = None


class QualificationUpdate(BaseModel):
    """Schema for updating a partner qualification."""

    qualification_level: QualificationLevel | None = None
    notes: str | None = None


class QualificationApproval(BaseModel):
    """Schema for approving/rejecting a qualification."""

    status: ApprovalStatus
    notes: str | None = None


class QualificationResponse(BaseModel):
    """Schema for qualification response."""

    id: UUID
    partner_id: UUID
    category_id: UUID
    category_name: str | None = None
    qualification_level: str
    approval_status: str
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    notes: str | None = None
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
    notes: str | None = None


class CertificationUpdate(BaseModel):
    """Schema for updating a partner certification."""

    name: str | None = Field(None, max_length=200)
    issuing_body: str | None = Field(None, max_length=200)
    certificate_number: str | None = Field(None, max_length=100)
    issue_date: date | None = None
    expiry_date: date | None = None
    document_url: str | None = Field(None, max_length=500)
    notes: str | None = None


class CertificationVerification(BaseModel):
    """Schema for verifying a certification."""

    status: CertificationStatus
    notes: str | None = None


class CertificationResponse(BaseModel):
    """Schema for certification response."""

    id: UUID
    partner_id: UUID
    name: str
    issuing_body: str
    certificate_number: str | None = None
    issue_date: date | None = None
    expiry_date: date | None = None
    document_url: str | None = None
    verification_status: str
    verified_by: UUID | None = None
    verified_at: datetime | None = None
    notes: str | None = None
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
    current_stage: str
    checklist_items: dict[str, dict[str, bool]] = {}
    completed_stages: list[str] = []
    assigned_coordinator: UUID | None = None
    coordinator_name: str | None = None
    started_at: datetime
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    progress_percentage: int = 0

    model_config = ConfigDict(from_attributes=True)


# Full Capability Matrix Response
class CapabilityMatrixResponse(BaseModel):
    """Full capability matrix for a partner."""

    partner_id: UUID
    firm_name: str
    capabilities: list[CapabilityResponse] = []
    qualifications: list[QualificationResponse] = []
    certifications: list[CertificationResponse] = []
    onboarding: OnboardingResponse | None = None
    capability_summary: dict[str, int] = {}  # {beginner: X, intermediate: Y, expert: Z}
    qualification_summary: dict[str, int] = {}  # {approved: X, pending: Y, rejected: Z}
