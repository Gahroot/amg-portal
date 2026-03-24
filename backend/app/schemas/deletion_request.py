"""Schemas for the two-person deletion authorization workflow."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DeletionRequestCreate(BaseModel):
    entity_type: str = Field(..., description="ORM table name of the entity to delete")
    entity_id: str = Field(..., description="UUID of the entity to delete")
    reason: str = Field(..., min_length=10, description="Why this entity should be deleted")


class DeletionRequestResponse(BaseModel):
    id: UUID
    entity_type: str
    entity_id: str
    requested_by: UUID
    requested_at: datetime
    reason: str
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    rejection_reason: str | None = None
    status: str
    executed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class DeletionRequestListResponse(BaseModel):
    requests: list[DeletionRequestResponse]
    total: int


class RejectDeletionRequest(BaseModel):
    reason: str = Field(..., min_length=5, description="Why this deletion request is rejected")
