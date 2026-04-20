"""Pydantic schemas for partner governance actions."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str255, Str2000

GovernanceActionType = Literal["warning", "probation", "suspension", "termination", "reinstatement"]


class GovernanceActionCreate(BaseModel):
    action: GovernanceActionType
    reason: Str2000
    evidence: dict[str, object] | None = None
    effective_date: datetime | None = None
    expiry_date: datetime | None = None


class GovernanceActionResponse(BaseModel):
    id: uuid.UUID
    partner_id: uuid.UUID
    action: Str50
    reason: Str2000
    evidence: dict[str, object] | None = None
    effective_date: datetime
    expiry_date: datetime | None = None
    issued_by: uuid.UUID
    issuer_name: Str255 | None = None
    partner_firm_name: Str255 | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GovernanceHistoryResponse(BaseModel):
    actions: list[GovernanceActionResponse]
    total: int


class CompositeScoreResponse(BaseModel):
    partner_id: uuid.UUID
    firm_name: Str255
    avg_rating_score: float | None = None
    sla_compliance_rate: float | None = None
    composite_score: float | None = None
    total_ratings: int = 0
    total_sla_tracked: int = 0
    total_sla_breached: int = 0
    recommended_action: Str50 | None = None
    current_governance_status: Str50 | None = None


class GovernanceDashboardEntry(BaseModel):
    partner_id: uuid.UUID
    firm_name: Str255
    composite_score: float | None = None
    current_action: Str50 | None = None
    current_action_date: Str50 | None = None
    sla_breach_count: int = 0
    avg_rating: float | None = None
    notice_count: int = 0


class GovernanceDashboardResponse(BaseModel):
    entries: list[GovernanceDashboardEntry]
    total: int
