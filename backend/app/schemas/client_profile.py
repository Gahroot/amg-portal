from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import ComplianceStatus
from app.schemas.base import Str50, Str100, Str255, Str500, Str2000

# ---------------------------------------------------------------------------
# Duplicate detection schemas
# ---------------------------------------------------------------------------


class DuplicateCheckRequest(BaseModel):
    legal_name: Str255 | None = None
    primary_email: EmailStr | None = None
    phone: Str50 | None = None
    exclude_id: UUID | None = None


class DuplicateMatchResponse(BaseModel):
    client_id: UUID
    legal_name: Str255
    display_name: Str255 | None
    primary_email: Str255
    phone: Str50 | None
    similarity_score: float
    match_reasons: list[str]


# ---------------------------------------------------------------------------
# Intelligence File structured schemas
# ---------------------------------------------------------------------------


class LifestyleProfile(BaseModel):
    travel_preferences: Str2000 | None = None
    dietary_restrictions: Str2000 | None = None
    interests: list[str] = []
    preferred_destinations: list[str] = []
    language_preference: Str50 | None = None


class KeyRelationship(BaseModel):
    name: Str255
    relationship: Str255
    notes: Str2000 | None = None


class IntelligenceFileSchema(BaseModel):
    """Structured client intelligence file."""

    objectives: list[str] = []
    preferences: dict[str, str] = {}
    sensitivities: list[str] = []
    key_relationships: list[KeyRelationship] = []
    lifestyle_profile: LifestyleProfile = LifestyleProfile()


class ImportantDate(BaseModel):
    label: Str255
    month: int
    day: int
    year: int | None = None
    recurring: bool = True


class ClientProfileCreate(BaseModel):
    legal_name: Str255
    display_name: Str255 | None = None
    entity_type: Str100 | None = None
    jurisdiction: Str100 | None = None
    tax_id: Str100 | None = None
    primary_email: EmailStr
    secondary_email: EmailStr | None = None
    phone: Str50 | None = None
    address: Str2000 | None = None
    communication_preference: Str50 | None = None
    sensitivities: Str2000 | None = None
    special_instructions: Str2000 | None = None
    birth_date: date | None = None
    important_dates: list[ImportantDate] | None = None


class ClientProfileUpdate(BaseModel):
    legal_name: Str255 | None = None
    display_name: Str255 | None = None
    entity_type: Str100 | None = None
    jurisdiction: Str100 | None = None
    tax_id: Str100 | None = None
    primary_email: EmailStr | None = None
    secondary_email: EmailStr | None = None
    phone: Str50 | None = None
    address: Str2000 | None = None
    communication_preference: Str50 | None = None
    sensitivities: Str2000 | None = None
    special_instructions: Str2000 | None = None
    birth_date: date | None = None
    important_dates: list[ImportantDate] | None = None
    birthday_reminders_enabled: bool | None = None


class ClientProfileResponse(BaseModel):
    id: UUID
    legal_name: Str255
    display_name: Str255 | None = None
    entity_type: Str100 | None = None
    jurisdiction: Str100 | None = None
    tax_id: Str100 | None = None
    primary_email: Str255
    secondary_email: Str255 | None = None
    phone: Str50 | None = None
    address: Str2000 | None = None
    communication_preference: Str50 | None = None
    sensitivities: Str2000 | None = None
    special_instructions: Str2000 | None = None
    compliance_status: Str50
    approval_status: Str50
    compliance_notes: Str2000 | None = None
    compliance_reviewed_by: UUID | None = None
    compliance_reviewed_at: datetime | None = None
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    assigned_rm_id: UUID | None = None
    security_profile_level: Str50 = "standard"
    intelligence_file: dict[str, Any] | None = None
    user_id: UUID | None = None
    welcome_email_sent: bool
    portal_access_enabled: bool
    compliance_certificate_id: UUID | None = None
    compliance_certificate_path: Str500 | None = None
    preferred_channels: list[str] | None = None
    contact_hours_start: Str50 | None = None
    contact_hours_end: Str50 | None = None
    contact_timezone: Str50 | None = None
    language_preference: Str50 | None = None
    do_not_contact: bool = False
    opt_out_marketing: bool = False
    birth_date: date | None = None
    important_dates: list[ImportantDate] | None = None
    birthday_reminders_enabled: bool = True
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientProfileListResponse(BaseModel):
    profiles: list[ClientProfileResponse]
    total: int


class ComplianceReviewRequest(BaseModel):
    status: ComplianceStatus
    notes: Str2000


class MDApprovalRequest(BaseModel):
    approved: bool
    notes: Str2000 | None = None
    assigned_rm_id: UUID | None = None


class ClientProvisionRequest(BaseModel):
    send_welcome_email: bool = True
    password: Str255 | None = None


class ComplianceCertificate(BaseModel):
    profile_id: UUID
    legal_name: Str255
    compliance_status: Str50
    reviewed_by: Str255 | None = None
    reviewed_at: datetime | None = None
    certificate_date: datetime


class ClientPortalProfileResponse(BaseModel):
    id: UUID
    legal_name: Str255
    display_name: Str255 | None = None
    entity_type: Str100 | None = None
    jurisdiction: Str100 | None = None
    primary_email: Str255
    compliance_status: Str50
    approval_status: Str50
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientProgramSummary(BaseModel):
    id: UUID
    title: Str255
    status: Str50
    start_date: date | None = None
    end_date: date | None = None
    milestone_count: int = 0
    completed_milestone_count: int = 0
    rag_status: Str50 = "green"


class ClientMilestoneSummary(BaseModel):
    id: UUID
    title: Str255
    description: Str2000 | None = None
    due_date: date | None = None
    status: Str50
    position: int


class ClientProgramDetail(BaseModel):
    id: UUID
    title: Str255
    objectives: Str2000 | None = None
    scope: Str2000 | None = None
    status: Str50
    start_date: date | None = None
    end_date: date | None = None
    milestone_count: int = 0
    completed_milestone_count: int = 0
    rag_status: Str50 = "green"
    milestones: list[ClientMilestoneSummary] = []


class ClientCommunicationSummary(BaseModel):
    id: UUID
    title: Str255 | None = None
    conversation_type: Str50
    last_activity_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
