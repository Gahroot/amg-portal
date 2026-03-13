"""Report schemas — client-facing reports response models."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

# ============================================================================
# Shared Components
# ============================================================================


class ReportMilestone(BaseModel):
    """Milestone summary for reports."""

    id: UUID
    title: str
    description: str | None
    due_date: date | None
    status: str
    position: int


class ReportDeliverable(BaseModel):
    """Deliverable summary for reports."""

    id: UUID
    title: str
    deliverable_type: str
    description: str | None
    due_date: date | None
    status: str
    client_visible: bool
    submitted_at: datetime | None
    reviewed_at: datetime | None


class ReportPartner(BaseModel):
    """Partner summary for reports."""

    id: UUID
    firm_name: str
    contact_name: str
    contact_email: str


class ReportPendingDecision(BaseModel):
    """Pending client decision for reports."""

    id: UUID
    title: str
    description: str | None
    requested_at: datetime
    deadline: datetime | None


# ============================================================================
# Portfolio Overview Report
# ============================================================================


class PortfolioProgramSummary(BaseModel):
    """Single program summary in portfolio."""

    id: UUID
    title: str
    status: str
    rag_status: str
    start_date: date | None
    end_date: date | None
    budget_envelope: Decimal | None
    milestone_count: int
    completed_milestone_count: int
    milestone_progress: float = Field(default=0.0, ge=0, le=100)


class PortfolioOverviewReport(BaseModel):
    """Portfolio overview report showing all client programs."""

    client_id: UUID
    client_name: str
    total_programs: int
    active_programs: int
    completed_programs: int
    total_budget: Decimal | None
    status_breakdown: dict[str, int] = Field(default_factory=dict)
    rag_summary: dict[str, int] = Field(default_factory=dict)
    overall_milestone_progress: float = Field(default=0.0, ge=0, le=100)
    programs: list[PortfolioProgramSummary] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Program Status Report
# ============================================================================


class ProgramStatusReport(BaseModel):
    """Program status report showing active milestones and pending items."""

    program_id: UUID
    program_title: str
    program_status: str
    rag_status: str
    start_date: date | None
    end_date: date | None
    milestone_progress: float = Field(default=0.0, ge=0, le=100)

    # Active milestones (not completed/cancelled)
    active_milestones: list[ReportMilestone] = Field(default_factory=list)

    # Completed deliverables (client_visible=True, status in approved/completed)
    completed_deliverables: list[ReportDeliverable] = Field(default_factory=list)

    # Pending client decisions
    pending_decisions: list[ReportPendingDecision] = Field(default_factory=list)

    # Partners assigned
    assigned_partners: list[ReportPartner] = Field(default_factory=list)

    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Program Completion Report
# ============================================================================


class CompletionMilestoneTimeline(BaseModel):
    """Milestone with completion timeline data."""

    id: UUID
    title: str
    planned_due_date: date | None
    actual_completed_at: datetime | None
    status: str
    on_time: bool | None = None  # None if not completed


class CompletionReport(BaseModel):
    """Program completion report with outcomes and timeline adherence."""

    program_id: UUID
    program_title: str
    client_id: UUID
    client_name: str
    objectives: str | None
    scope: str | None

    # Timeline
    planned_start_date: date | None
    planned_end_date: date | None
    actual_start_date: date | None
    actual_end_date: date | None
    timeline_adherence: str | None  # "on_time", "early", "late"

    # Budget
    planned_budget: Decimal | None
    actual_budget: Decimal | None

    # Milestone completion
    total_milestones: int
    completed_milestones: int
    milestone_timeline: list[CompletionMilestoneTimeline] = Field(default_factory=list)

    # Deliverables
    total_deliverables: int
    approved_deliverables: int
    deliverables: list[ReportDeliverable] = Field(default_factory=list)

    # Partners
    partners: list[ReportPartner] = Field(default_factory=list)

    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Annual Relationship Review
# ============================================================================


class AnnualProgramSummary(BaseModel):
    """Program summary for annual review."""

    id: UUID
    title: str
    status: str
    start_date: date | None
    end_date: date | None
    budget_envelope: Decimal | None
    rag_status: str


class MonthlyProgramCount(BaseModel):
    """Program count by month."""

    month: int
    month_name: str
    new_programs: int
    completed_programs: int


class PartnerPerformanceSummary(BaseModel):
    """Partner performance summary for annual review."""

    partner_id: UUID
    firm_name: str
    total_assignments: int
    completed_assignments: int
    avg_performance_rating: float | None


class AnnualReviewReport(BaseModel):
    """Annual relationship review across all programs."""

    client_id: UUID
    client_name: str
    year: int

    # Program aggregates
    total_programs: int
    new_programs: int
    completed_programs: int
    active_programs: int

    # Engagement value
    total_engagement_value: Decimal | None
    total_budget_consumed: Decimal | None

    # Programs by status
    programs_by_status: dict[str, int] = Field(default_factory=dict)

    # Monthly breakdown
    programs_by_month: list[MonthlyProgramCount] = Field(default_factory=list)

    # Partner performance
    partner_performance: list[PartnerPerformanceSummary] = Field(default_factory=list)

    # All programs for the year
    programs: list[AnnualProgramSummary] = Field(default_factory=list)

    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Class B — Internal Operational Reports
# ============================================================================


# --- Partner Performance Scorecard Report ---


class PartnerScorecardEntry(BaseModel):
    """Single partner entry in the scorecard report."""

    partner_id: UUID
    firm_name: str
    avg_quality: float | None
    avg_timeliness: float | None
    avg_communication: float | None
    avg_overall: float | None
    total_ratings: int
    total_assignments: int
    completed_assignments: int
    completion_rate: float
    sla_breach_count: int


class PartnerScorecardReport(BaseModel):
    """Partner Performance Scorecard — aggregated partner metrics."""

    partners: list[PartnerScorecardEntry] = Field(default_factory=list)
    total_partners: int
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# --- RM Portfolio Report ---


class RMPortfolioEntry(BaseModel):
    """Single RM entry in the portfolio report."""

    rm_id: UUID
    rm_name: str
    rm_email: str
    client_count: int
    active_program_count: int
    completed_program_count: int
    completion_rate: float
    avg_program_health: float | None
    revenue_pipeline: Decimal | None
    avg_nps_score: float | None


class RMPortfolioReport(BaseModel):
    """RM Portfolio Report — per-RM client and program metrics."""

    entries: list[RMPortfolioEntry] = Field(default_factory=list)
    total_rms: int
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# --- Escalation Log Report ---


class EscalationLogEntry(BaseModel):
    """Single escalation in the log report."""

    id: UUID
    title: str
    description: str | None
    level: str
    status: str
    owner_id: UUID
    owner_name: str
    program_id: UUID | None
    triggered_at: datetime
    age_hours: float
    acknowledged_at: datetime | None
    resolved_at: datetime | None
    resolution_notes: str | None


class EscalationLogReport(BaseModel):
    """Escalation Log Report — all escalations with filters."""

    escalations: list[EscalationLogEntry] = Field(default_factory=list)
    total: int
    open_count: int
    acknowledged_count: int
    resolved_count: int
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# --- Compliance Audit Report ---


class KYCSummary(BaseModel):
    """KYC document status summary."""

    total_documents: int
    current: int
    expiring_within_30_days: int
    expired: int
    pending: int
    rejected: int


class KYCClientDetail(BaseModel):
    """KYC completeness per client."""

    client_id: UUID
    client_name: str
    total_documents: int
    current: int
    expired: int
    expiring_soon: int
    pending: int


class AccessAuditSummary(BaseModel):
    """Summary of latest access audit."""

    audit_id: UUID | None
    audit_period: str | None
    status: str | None
    users_reviewed: int
    permissions_verified: int
    anomalies_found: int
    open_findings: int
    total_findings: int


class ComplianceAuditReport(BaseModel):
    """Compliance Audit Report — KYC status + access audit summary."""

    kyc_summary: KYCSummary
    kyc_by_client: list[KYCClientDetail] = Field(default_factory=list)
    access_audit: AccessAuditSummary
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Class C — Partner-Facing Reports
# ============================================================================


# --- Active Brief Summary ---


class ActiveBriefDeliverable(BaseModel):
    """Deliverable info within an active brief."""

    id: UUID
    title: str
    deliverable_type: str
    description: str | None
    due_date: date | None
    status: str


class ActiveBriefEntry(BaseModel):
    """Single active assignment brief."""

    id: UUID
    title: str
    brief: str
    sla_terms: str | None
    status: str
    due_date: date | None
    program_title: str | None
    accepted_at: datetime | None
    created_at: datetime
    deliverables: list[ActiveBriefDeliverable] = Field(default_factory=list)


class ActiveBriefSummaryReport(BaseModel):
    """Active Brief Summary — partner's current assignments with deliverables."""

    assignments: list[ActiveBriefEntry] = Field(default_factory=list)
    total_assignments: int
    total_deliverables: int
    pending_deliverables: int
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# --- Deliverable Feedback Report ---


class DeliverableFeedbackEntry(BaseModel):
    """Single deliverable with feedback details."""

    id: UUID
    assignment_id: UUID
    assignment_title: str
    title: str
    deliverable_type: str
    status: str
    due_date: date | None
    submitted_at: datetime | None
    review_comments: str | None
    reviewer_name: str | None
    reviewed_at: datetime | None


class DeliverableFeedbackReport(BaseModel):
    """Deliverable Feedback Report — all deliverables with review info."""

    deliverables: list[DeliverableFeedbackEntry] = Field(default_factory=list)
    total: int
    reviewed_count: int
    pending_count: int
    approved_count: int
    returned_count: int
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# --- Engagement History Report ---


class EngagementRating(BaseModel):
    """Performance rating for a completed engagement."""

    quality_score: int
    timeliness_score: int
    communication_score: int
    overall_score: int


class EngagementHistoryEntry(BaseModel):
    """Single completed engagement entry."""

    id: UUID
    title: str
    program_title: str | None
    status: str
    due_date: date | None
    accepted_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    rating: EngagementRating | None = None


class EngagementHistoryStats(BaseModel):
    """Aggregate statistics for engagement history."""

    total_engagements: int
    completed_engagements: int
    completion_rate: float
    average_quality: float | None
    average_timeliness: float | None
    average_communication: float | None
    average_overall: float | None


class EngagementHistoryReport(BaseModel):
    """Engagement History Report — completed assignments with ratings."""

    engagements: list[EngagementHistoryEntry] = Field(default_factory=list)
    stats: EngagementHistoryStats
    generated_at: datetime = Field(default_factory=datetime.utcnow)
