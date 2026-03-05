from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class EscalationResponse(BaseModel):
    id: UUID
    level: str
    status: str
    title: str
    description: str | None = None
    entity_type: str
    entity_id: str
    owner_id: UUID
    owner_email: str | None = None
    owner_name: str | None = None
    program_id: UUID | None = None
    client_id: UUID | None = None
    triggered_at: datetime
    acknowledged_at: datetime | None = None
    resolved_at: datetime | None = None
    closed_at: datetime | None = None
    triggered_by: UUID
    triggered_by_email: str | None = None
    triggered_by_name: str | None = None
    risk_factors: dict[str, object] | None = None
    escalation_chain: list[dict[str, object]] | None = None
    resolution_notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EscalationListResponse(BaseModel):
    escalations: list[EscalationResponse]
    total: int


class EscalationCreate(BaseModel):
    title: str
    description: str | None = None
    entity_type: str
    entity_id: str
    level: str
    program_id: UUID | None = None
    client_id: UUID | None = None


class EscalationUpdate(BaseModel):
    status: str | None = None
    resolution_notes: str | None = None


class EscalationTriggerRequest(BaseModel):
    entity_type: str
    entity_id: str
    level: str
    reason: str
