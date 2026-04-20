"""Dashboard and partner scoring response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.base import Str50, Str100, Str255, Str500, Str2000


class ProgramHealthItem(BaseModel):
    id: uuid.UUID
    title: Str255
    status: Str50
    client_name: Str255
    rag_status: Str50
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
    firm_name: Str255
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
    firm_name: Str255
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
    comments: Str2000 | None
    created_at: datetime


class RealTimeStats(BaseModel):
    active_programs: int
    pending_approvals: int
    open_escalations: int
    sla_breaches: int
    unread_notifications: int
    upcoming_deadlines: int


class ActivityFeedItem(BaseModel):
    id: Str100
    activity_type: Str50  # "communication", "status_change", "escalation", "deliverable_submission"
    title: Str255
    description: Str2000
    entity_type: Str50  # "program", "escalation", "deliverable", "communication"
    entity_id: Str100
    timestamp: datetime
    actor_name: Str255 | None = None
    link: Str500 | None = None


class ActivityFeedResponse(BaseModel):
    items: list[ActivityFeedItem]
    total: int


class DashboardAlert(BaseModel):
    id: Str100
    severity: Str50  # "critical", "warning", "info"
    alert_type: Str50  # "sla_breach", "overdue_task", "pending_review", "expiring_document"
    title: Str255
    description: Str2000
    entity_type: Str50
    entity_id: Str100
    link: Str500 | None = None
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
    week_start: Str50
    sla_compliance_pct: float | None
    avg_quality: float | None
    avg_overall: float | None
    assignments_completed: int


class PartnerScorecardResponse(BaseModel):
    partner_id: Str100
    firm_name: Str255
    period: Str50
    metrics: ScorecardMetrics
    rating_breakdown: ScorecardRatingBreakdown
    totals: ScorecardTotals
    averages: ScorecardAverages
    data_points: list[ScorecardDataPoint]
