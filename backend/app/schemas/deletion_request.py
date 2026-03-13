"""Schemas for two-person deletion request operations."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DeletionRequestCreate(BaseModel):
    entity_type: str  # client_profile, document, program
    entity_id: UUID
    reason: str
    retention_days: int = 90


class DeletionRequestResponse(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    reason: str
    requested_by: UUID
    approved_by: UUID | None = None
    status: str
    retention_days: int
    scheduled_purge_at: datetime | None = None
    rejection_reason: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DeletionRequestListResponse(BaseModel):
    deletion_requests: list[DeletionRequestResponse]
    total: int


class DeletionRequestApprove(BaseModel):
    """Body is optional — approval only needs the authenticated user."""
    pass


class DeletionRequestReject(BaseModel):
    reason: str
