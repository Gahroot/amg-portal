"""Pydantic schemas for family members and relationships."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class FamilyMemberCreate(BaseModel):
    """Request body for creating a family member."""

    name: str
    relationship_type: str
    date_of_birth: datetime | None = None
    occupation: str | None = None
    notes: str | None = None
    is_primary_contact: bool = False


class FamilyMemberUpdate(BaseModel):
    """Request body for updating a family member."""

    name: str | None = None
    relationship_type: str | None = None
    date_of_birth: datetime | None = None
    occupation: str | None = None
    notes: str | None = None
    is_primary_contact: bool | None = None


class FamilyMemberResponse(BaseModel):
    """Response body for a family member."""

    id: UUID
    client_profile_id: UUID
    name: str
    relationship_type: str
    date_of_birth: datetime | None = None
    occupation: str | None = None
    notes: str | None = None
    is_primary_contact: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FamilyMemberListResponse(BaseModel):
    """Response body for listing family members."""

    family_members: list[FamilyMemberResponse]
    total: int


class FamilyRelationshipCreate(BaseModel):
    """Request body for creating a relationship between family members."""

    to_member_id: UUID
    relationship_type: str


class FamilyRelationshipResponse(BaseModel):
    """Response body for a family relationship."""

    id: UUID
    from_member_id: UUID
    to_member_id: UUID
    relationship_type: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
