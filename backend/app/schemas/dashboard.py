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
    probationary_partner_count: int


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


class RealTimeStats(BaseModel):
    active_programs: int
    pending_approvals: int
    open_escalations: int
    sla_breaches: int
    unread_notifications: int
    upcoming_deadlines: int


class ActivityFeedItem(BaseModel):
    id: str
    activity_type: str  # "communication", "status_change", "escalation", "deliverable_submission"
    title: str
    description: str
    entity_type: str  # "program", "escalation", "deliverable", "communication"
    entity_id: str
    timestamp: datetime
    actor_name: str | None = None
    link: str | None = None


class ActivityFeedResponse(BaseModel):
    items: list[ActivityFeedItem]
    total: int


class DashboardAlert(BaseModel):
    id: str
    severity: str  # "critical", "warning", "info"
    alert_type: str  # "sla_breach", "overdue_task", "pending_review", "expiring_document"
    title: str
    description: str
    entity_type: str
    entity_id: str
    link: str | None = None
    due_date: datetime | None = None


class AlertsResponse(BaseModel):
    alerts: list[DashboardAlert]
    total: int


# ── Partner Scorecard (partner-portal facing) ──────────────────────────────────


class ScorecardMetrics(BaseModel):
    composite_score: float | None
    sla_compliance_pct: float | None
    avg_response_time_hours: float | None
    quality_score: float | None
    on_time_delivery_rate: float | None
    client_satisfaction: float | None


class ScorecardRatingBreakdown(BaseModel):
    avg_quality: float | None
    avg_timeliness: float | None
    avg_communication: float | None
    avg_overall: float | None


class ScorecardTotals(BaseModel):
    total_assignments: int
    completed_assignments: int
    total_sla_checked: int
    total_sla_breached: int
    total_ratings: int


class ScorecardAverages(BaseModel):
    composite_score: float | None
    sla_compliance_pct: float | None
    quality_score: float | None
    client_satisfaction: float | None


class ScorecardDataPoint(BaseModel):
    week_start: str
    sla_compliance_pct: float | None
    avg_quality: float | None
    avg_overall: float | None
    assignments_completed: int


class PartnerScorecardResponse(BaseModel):
    partner_id: str
    firm_name: str
    period: str
    metrics: ScorecardMetrics
    rating_breakdown: ScorecardRatingBreakdown
    totals: ScorecardTotals
    averages: ScorecardAverages
    data_points: list[ScorecardDataPoint]
