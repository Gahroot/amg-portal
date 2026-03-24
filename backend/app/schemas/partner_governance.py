"""Pydantic schemas for partner governance actions."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

GovernanceActionType = Literal[
    "warning", "probation", "suspension", "termination", "reinstatement"
]


class GovernanceActionCreate(BaseModel):
    action: GovernanceActionType
    reason: str
    evidence: dict[str, object] | None = None
    effective_date: datetime | None = None
    expiry_date: datetime | None = None


class GovernanceActionResponse(BaseModel):
    id: uuid.UUID
    partner_id: uuid.UUID
    action: str
    reason: str
    evidence: dict[str, object] | None = None
    effective_date: datetime
    expiry_date: datetime | None = None
    issued_by: uuid.UUID
    issuer_name: str | None = None
    partner_firm_name: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GovernanceHistoryResponse(BaseModel):
    actions: list[GovernanceActionResponse]
    total: int


class CompositeScoreResponse(BaseModel):
    partner_id: uuid.UUID
    firm_name: str
    avg_rating_score: float | None = None
    sla_compliance_rate: float | None = None
    composite_score: float | None = None
    total_ratings: int = 0
    total_sla_tracked: int = 0
    total_sla_breached: int = 0
    recommended_action: str | None = None
    current_governance_status: str | None = None


class GovernanceDashboardEntry(BaseModel):
    partner_id: uuid.UUID
    firm_name: str
    composite_score: float | None = None
    current_action: str | None = None
    current_action_date: str | None = None
    sla_breach_count: int = 0
    avg_rating: float | None = None
    notice_count: int = 0


class GovernanceDashboardResponse(BaseModel):
    entries: list[GovernanceDashboardEntry]
    total: int
