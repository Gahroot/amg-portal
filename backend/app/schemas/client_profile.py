from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr

from app.models.enums import ComplianceStatus


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
    intelligence_file: dict[str, Any] | None = None
    external_crm_id: str | None = None
    user_id: UUID | None = None
    welcome_email_sent: bool
    portal_access_enabled: bool
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


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

    model_config = {"from_attributes": True}
