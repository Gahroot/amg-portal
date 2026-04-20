from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import ClientType, LeadSource, LeadStatus
from app.schemas.base import Str50, Str255, Str500, Str2000


class LeadBase(BaseModel):
    full_name: str = Field(..., max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50)
    company: str | None = Field(None, max_length=255)
    status: LeadStatus = LeadStatus.new
    source: LeadSource = LeadSource.other
    source_details: str | None = Field(None, max_length=500)
    estimated_value: Decimal | None = None
    estimated_client_type: ClientType | None = None
    referred_by_partner_id: UUID | None = None
    notes: Str2000 | None = None


class LeadCreate(LeadBase):
    owner_id: UUID | None = None


class LeadUpdate(BaseModel):
    full_name: str | None = Field(None, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50)
    company: str | None = Field(None, max_length=255)
    status: LeadStatus | None = None
    source: LeadSource | None = None
    source_details: str | None = Field(None, max_length=500)
    estimated_value: Decimal | None = None
    estimated_client_type: ClientType | None = None
    owner_id: UUID | None = None
    referred_by_partner_id: UUID | None = None
    notes: Str2000 | None = None
    disqualified_reason: str | None = Field(None, max_length=500)


class LeadResponse(BaseModel):
    id: UUID
    full_name: Str255
    email: Str255 | None
    phone: Str50 | None
    company: Str255 | None
    status: LeadStatus
    source: LeadSource
    source_details: Str500 | None
    estimated_value: Decimal | None
    estimated_client_type: ClientType | None
    owner_id: UUID
    referred_by_partner_id: UUID | None
    notes: Str2000 | None
    disqualified_reason: Str500 | None
    converted_at: datetime | None
    converted_client_profile_id: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeadListResponse(BaseModel):
    leads: list[LeadResponse]
    total: int


class LeadConvertRequest(BaseModel):
    """Convert a qualified lead into a ClientProfile intake."""

    legal_name: Str255
    primary_email: EmailStr
    entity_type: ClientType
    phone: Str50 | None = None
    notes: Str2000 | None = None
