from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str100, Str255, Str2000


class EscalationResponse(BaseModel):
    id: UUID
    level: Str50
    status: Str50
    title: Str255
    description: Str2000 | None = None
    entity_type: Str50
    entity_id: Str100
    owner_id: UUID
    owner_email: Str255 | None = None
    owner_name: Str255 | None = None
    program_id: UUID | None = None
    client_id: UUID | None = None
    triggered_at: datetime
    acknowledged_at: datetime | None = None
    resolved_at: datetime | None = None
    closed_at: datetime | None = None
    triggered_by: UUID
    triggered_by_email: Str255 | None = None
    triggered_by_name: Str255 | None = None
    risk_factors: dict[str, object] | None = None
    escalation_chain: list[dict[str, object]] | None = None
    resolution_notes: Str2000 | None = None
    created_at: datetime
    updated_at: datetime
    response_deadline: datetime | None = None
    is_overdue: bool = False

    model_config = ConfigDict(from_attributes=True)


class EscalationListResponse(BaseModel):
    escalations: list[EscalationResponse]
    total: int


class EscalationCreate(BaseModel):
    title: Str255
    description: Str2000 | None = None
    entity_type: Str50
    entity_id: Str100
    level: Str50
    program_id: UUID | None = None
    client_id: UUID | None = None


class EscalationUpdate(BaseModel):
    status: Str50 | None = None
    resolution_notes: Str2000 | None = None


class EscalationTriggerRequest(BaseModel):
    entity_type: Str50
    entity_id: Str100
    level: Str50
    reason: Str2000


class EscalationChainEntry(BaseModel):
    action: Str50
    at: Str50
    by: Str255 | None = None
    level: Str50 | None = None
    notes: Str2000 | None = None
    from_level: Str50 | None = None
    to_level: Str50 | None = None


class EscalationChainResponse(BaseModel):
    escalation_id: UUID
    current_level: Str50
    chain: list[dict[str, object]]
    total_entries: int


class EscalationProgressRequest(BaseModel):
    notes: Str2000 | None = None


class EscalationMetricsResponse(BaseModel):
    open_by_level: dict[str, int]
    avg_resolution_time_hours: float | None
    overdue_count: int
    sla_compliance_pct: float | None
    trend_this_week: int
    trend_last_week: int


class OverdueEscalationResponse(BaseModel):
    escalations: list[EscalationResponse]
    total: int


class ReassignRequest(BaseModel):
    new_owner_id: UUID
