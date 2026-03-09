"""Dashboard and partner scoring response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class ProgramHealthItem(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    client_name: str
    rag_status: str
    milestone_count: int
    completed_milestone_count: int
    milestone_progress: float
    active_escalation_count: int
    sla_breach_count: int


class ProgramHealthResponse(BaseModel):
    programs: list[ProgramHealthItem]
    total: int


class PortfolioSummary(BaseModel):
    total_programs: int
    active_programs: int
    completed_programs: int
    total_clients: int
    rag_breakdown: dict[str, int]
    total_open_escalations: int
    total_sla_breaches: int
    total_pending_decisions: int


class PartnerScorecard(BaseModel):
    partner_id: uuid.UUID
    firm_name: str
    avg_quality: float | None
    avg_timeliness: float | None
    avg_communication: float | None
    avg_overall: float | None
    total_ratings: int
    total_assignments: int
    completed_assignments: int
    active_assignments: int


class PartnerRanking(BaseModel):
    partner_id: uuid.UUID
    firm_name: str
    avg_overall: float | None
    total_ratings: int
    total_assignments: int


class PartnerRankingsResponse(BaseModel):
    rankings: list[PartnerRanking]
    total: int


class PartnerPerformanceEntry(BaseModel):
    rating_id: uuid.UUID
    program_id: uuid.UUID
    quality_score: int
    timeliness_score: int
    communication_score: int
    overall_score: int
    comments: str | None
    created_at: datetime
