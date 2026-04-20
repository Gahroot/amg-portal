"""Pydantic schemas for client intake form."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.schemas.base import Str50, Str100, Str255, Str2000
from app.schemas.family_member import FamilyMemberCreate, FamilyMemberResponse


class IntakeStep1Identity(BaseModel):
    """Step 1: Identity information."""

    legal_name: Str255
    display_name: Str255 | None = None
    entity_type: Str100 | None = None
    jurisdiction: Str100 | None = None
    tax_id: Str100 | None = None


class IntakeStep2Contact(BaseModel):
    """Step 2: Contact information."""

    primary_email: EmailStr
    secondary_email: EmailStr | None = None
    phone: Str50 | None = None
    address: Str2000 | None = None


class IntakeStep3Preferences(BaseModel):
    """Step 3: Communication preferences."""

    communication_preference: Str50 | None = None
    sensitivities: Str2000 | None = None
    special_instructions: Str2000 | None = None


class IntakeStep4Lifestyle(BaseModel):
    """Step 4: Lifestyle and travel preferences."""

    travel_preferences: Str2000 | None = None
    dietary_restrictions: Str2000 | None = None
    interests: Str2000 | None = None
    preferred_destinations: list[str] | None = None
    language_preference: Str50 | None = None


class IntakeFormData(BaseModel):
    """Complete intake form data."""

    # Step 1
    legal_name: Str255
    display_name: Str255 | None = None
    entity_type: Str100 | None = None
    jurisdiction: Str100 | None = None
    tax_id: Str100 | None = None

    # Step 2
    primary_email: EmailStr
    secondary_email: EmailStr | None = None
    phone: Str50 | None = None
    address: Str2000 | None = None

    # Step 3
    communication_preference: Str50 | None = None
    sensitivities: Str2000 | None = None
    special_instructions: Str2000 | None = None

    # Step 4
    travel_preferences: Str2000 | None = None
    dietary_restrictions: Str2000 | None = None
    interests: Str2000 | None = None
    preferred_destinations: list[str] | None = None
    language_preference: Str50 | None = None

    # Step 5 - Family members
    family_members: list[FamilyMemberCreate] | None = None


class IntakeDraftData(BaseModel):
    """Draft intake form data (partial)."""

    # Step 1
    legal_name: Str255 | None = None
    display_name: Str255 | None = None
    entity_type: Str100 | None = None
    jurisdiction: Str100 | None = None
    tax_id: Str100 | None = None

    # Step 2
    primary_email: Str255 | None = None
    secondary_email: Str255 | None = None
    phone: Str50 | None = None
    address: Str2000 | None = None

    # Step 3
    communication_preference: Str50 | None = None
    sensitivities: Str2000 | None = None
    special_instructions: Str2000 | None = None

    # Step 4
    travel_preferences: Str2000 | None = None
    dietary_restrictions: Str2000 | None = None
    interests: Str2000 | None = None
    preferred_destinations: list[str] | None = None
    language_preference: Str50 | None = None

    # Step 5
    family_members: list[FamilyMemberCreate] | None = None


class IntakeFormResponse(BaseModel):
    """Response body for intake form."""

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
    intelligence_file: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime
    family_members: list[FamilyMemberResponse] = []
    lifestyle: IntakeStep4Lifestyle | None = None

    model_config = ConfigDict(from_attributes=True)
