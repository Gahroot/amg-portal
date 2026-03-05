from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, EmailStr


class PartnerProfileCreate(BaseModel):
    firm_name: str
    contact_name: str
    contact_email: EmailStr
    contact_phone: str | None = None
    capabilities: list[str] = []
    geographies: list[str] = []
    notes: str | None = None


class PartnerProfileUpdate(BaseModel):
    firm_name: str | None = None
    contact_name: str | None = None
    contact_email: EmailStr | None = None
    contact_phone: str | None = None
    capabilities: list[str] | None = None
    geographies: list[str] | None = None
    availability_status: str | None = None
    compliance_verified: bool | None = None
    notes: str | None = None
    status: str | None = None


class PartnerProfileResponse(BaseModel):
    id: UUID
    user_id: UUID | None = None
    firm_name: str
    contact_name: str
    contact_email: str
    contact_phone: str | None = None
    capabilities: list[str] = []
    geographies: list[str] = []
    availability_status: str
    performance_rating: Decimal | None = None
    total_assignments: int
    completed_assignments: int
    compliance_doc_url: str | None = None
    compliance_verified: bool
    notes: str | None = None
    status: str
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PartnerProfileListResponse(BaseModel):
    profiles: list[PartnerProfileResponse]
    total: int


class PartnerProvisionRequest(BaseModel):
    password: str | None = None
    send_welcome_email: bool = False
