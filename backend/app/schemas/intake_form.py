"""Pydantic schemas for client intake form."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.schemas.family_member import FamilyMemberCreate, FamilyMemberResponse


class IntakeStep1Identity(BaseModel):
    """Step 1: Identity information."""

    legal_name: str
    display_name: str | None = None
    entity_type: str | None = None
    jurisdiction: str | None = None
    tax_id: str | None = None


class IntakeStep2Contact(BaseModel):
    """Step 2: Contact information."""

    primary_email: EmailStr
    secondary_email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None


class IntakeStep3Preferences(BaseModel):
    """Step 3: Communication preferences."""

    communication_preference: str | None = None
    sensitivities: str | None = None
    special_instructions: str | None = None


class IntakeStep4Lifestyle(BaseModel):
    """Step 4: Lifestyle and travel preferences."""

    travel_preferences: str | None = None
    dietary_restrictions: str | None = None
    interests: str | None = None
    preferred_destinations: list[str] | None = None
    language_preference: str | None = None


class IntakeFormData(BaseModel):
    """Complete intake form data."""

    # Step 1
    legal_name: str
    display_name: str | None = None
    entity_type: str | None = None
    jurisdiction: str | None = None
    tax_id: str | None = None

    # Step 2
    primary_email: EmailStr
    secondary_email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None

    # Step 3
    communication_preference: str | None = None
    sensitivities: str | None = None
    special_instructions: str | None = None

    # Step 4
    travel_preferences: str | None = None
    dietary_restrictions: str | None = None
    interests: str | None = None
    preferred_destinations: list[str] | None = None
    language_preference: str | None = None

    # Step 5 - Family members
    family_members: list[FamilyMemberCreate] | None = None


class IntakeDraftData(BaseModel):
    """Draft intake form data (partial)."""

    # Step 1
    legal_name: str | None = None
    display_name: str | None = None
    entity_type: str | None = None
    jurisdiction: str | None = None
    tax_id: str | None = None

    # Step 2
    primary_email: str | None = None
    secondary_email: str | None = None
    phone: str | None = None
    address: str | None = None

    # Step 3
    communication_preference: str | None = None
    sensitivities: str | None = None
    special_instructions: str | None = None

    # Step 4
    travel_preferences: str | None = None
    dietary_restrictions: str | None = None
    interests: str | None = None
    preferred_destinations: list[str] | None = None
    language_preference: str | None = None

    # Step 5
    family_members: list[FamilyMemberCreate] | None = None


class IntakeFormResponse(BaseModel):
    """Response body for intake form."""

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
    intelligence_file: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime
    family_members: list[FamilyMemberResponse] = []
    lifestyle: IntakeStep4Lifestyle | None = None

    model_config = ConfigDict(from_attributes=True)
