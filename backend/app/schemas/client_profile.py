from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import ComplianceStatus

# ---------------------------------------------------------------------------
# Duplicate detection schemas
# ---------------------------------------------------------------------------


class DuplicateCheckRequest(BaseModel):
    legal_name: str | None = None
    primary_email: EmailStr | None = None
    phone: str | None = None
    exclude_id: UUID | None = None


class DuplicateMatchResponse(BaseModel):
    client_id: UUID
    legal_name: str
    display_name: str | None
    primary_email: str
    phone: str | None
    similarity_score: float
    match_reasons: list[str]


# ---------------------------------------------------------------------------
# Intelligence File structured schemas
# ---------------------------------------------------------------------------


class LifestyleProfile(BaseModel):
    travel_preferences: str | None = None
    dietary_restrictions: str | None = None
    interests: list[str] = []
    preferred_destinations: list[str] = []
    language_preference: str | None = None


class KeyRelationship(BaseModel):
    name: str
    relationship: str
    notes: str | None = None


class IntelligenceFileSchema(BaseModel):
    """Structured client intelligence file."""

    objectives: list[str] = []
    preferences: dict[str, str] = {}
    sensitivities: list[str] = []
    key_relationships: list[KeyRelationship] = []
    lifestyle_profile: LifestyleProfile = LifestyleProfile()


class ImportantDate(BaseModel):
    label: str
    month: int
    day: int
    year: int | None = None
    recurring: bool = True


class ClientProfileCreate(BaseModel):
    legal_name: str
    display_name: str | None = None
    entity_type: str | None = None
    jurisdiction: str | None = None
    tax_id: str | None = None
    primary_email: EmailStr
    secondary_email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    communication_preference: str | None = None
    sensitivities: str | None = None
    special_instructions: str | None = None
    birth_date: date | None = None
    important_dates: list[ImportantDate] | None = None


class ClientProfileUpdate(BaseModel):
    legal_name: str | None = None
    display_name: str | None = None
    entity_type: str | None = None
    jurisdiction: str | None = None
    tax_id: str | None = None
    primary_email: EmailStr | None = None
    secondary_email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    communication_preference: str | None = None
    sensitivities: str | None = None
    special_instructions: str | None = None
    birth_date: date | None = None
    important_dates: list[ImportantDate] | None = None
    birthday_reminders_enabled: bool | None = None


class ClientProfileResponse(BaseModel):
    id: UUID
    legal_name: str
    display_name: str | None = None
    entity_type: str | None = None
    jurisdiction: str | None = None
    tax_id: str | None = None
    primary_email: str
    secondary_email: str | None = None
    phone: str | None = None
    address: str | None = None
    communication_preference: str | None = None
    sensitivities: str | None = None
    special_instructions: str | None = None
    compliance_status: str
    approval_status: str
    compliance_notes: str | None = None
    compliance_reviewed_by: UUID | None = None
    compliance_reviewed_at: datetime | None = None
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    assigned_rm_id: UUID | None = None
    security_profile_level: str = "standard"
    intelligence_file: dict[str, Any] | None = None
    user_id: UUID | None = None
    welcome_email_sent: bool
    portal_access_enabled: bool
    compliance_certificate_id: UUID | None = None
    compliance_certificate_path: str | None = None
    preferred_channels: list[str] | None = None
    contact_hours_start: str | None = None
    contact_hours_end: str | None = None
    contact_timezone: str | None = None
    language_preference: str | None = None
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
    notes: str


class MDApprovalRequest(BaseModel):
    approved: bool
    notes: str | None = None
    assigned_rm_id: UUID | None = None


class ClientProvisionRequest(BaseModel):
    send_welcome_email: bool = True
    password: str | None = None


class ComplianceCertificate(BaseModel):
    profile_id: UUID
    legal_name: str
    compliance_status: str
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None
    certificate_date: datetime


class ClientPortalProfileResponse(BaseModel):
    id: UUID
    legal_name: str
    display_name: str | None = None
    entity_type: str | None = None
    jurisdiction: str | None = None
    primary_email: str
    compliance_status: str
    approval_status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientProgramSummary(BaseModel):
    id: UUID
    title: str
    status: str
    start_date: date | None = None
    end_date: date | None = None
    milestone_count: int = 0
    completed_milestone_count: int = 0
    rag_status: str = "green"


class ClientMilestoneSummary(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    due_date: date | None = None
    status: str
    position: int


class ClientProgramDetail(BaseModel):
    id: UUID
    title: str
    objectives: str | None = None
    scope: str | None = None
    status: str
    start_date: date | None = None
    end_date: date | None = None
    milestone_count: int = 0
    completed_milestone_count: int = 0
    rag_status: str = "green"
    milestones: list[ClientMilestoneSummary] = []


class ClientCommunicationSummary(BaseModel):
    id: UUID
    title: str | None = None
    conversation_type: str
    last_activity_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
