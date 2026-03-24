"""Report schemas — client-facing and internal operational reports."""

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
# Partner Reports (Class C) — partner-facing, scoped to own data only
# ============================================================================


class PartnerBriefSummaryItem(BaseModel):
    """Single active assignment for the brief summary report."""

    assignment_id: UUID
    assignment_title: str
    status: str
    brief: str | None
    sla_terms: str | None
    due_date: date | None
    accepted_at: datetime | None
    program_title: str | None
    coordinator_name: str | None
    coordinator_email: str | None


class PartnerBriefSummaryReport(BaseModel):
    """Active brief summary — active assignments with tasks, deadlines, coordinator contact."""

    partner_id: UUID
    firm_name: str
    total_active: int
    assignments: list[PartnerBriefSummaryItem] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class PartnerDeliverableFeedbackItem(BaseModel):
    """Single deliverable feedback entry."""

    deliverable_id: UUID
    title: str
    deliverable_type: str
    assignment_id: UUID
    assignment_title: str | None
    status: str
    submitted_at: datetime | None
    reviewed_at: datetime | None
    review_comments: str | None
    due_date: date | None


class PartnerDeliverableFeedbackReport(BaseModel):
    """History of deliverable submissions with review status and reviewer comments."""

    partner_id: UUID
    firm_name: str
    total_deliverables: int
    deliverables: list[PartnerDeliverableFeedbackItem] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class PartnerEngagementHistoryItem(BaseModel):
    """Single engagement entry in the partner history report."""

    assignment_id: UUID
    title: str
    program_title: str | None
    status: str
    created_at: datetime
    accepted_at: datetime | None
    completed_at: datetime | None
    due_date: date | None
    deliverable_count: int
    approved_deliverable_count: int


class PartnerEngagementHistoryReport(BaseModel):
    """All past engagements for the current partner with completion stats."""

    partner_id: UUID
    firm_name: str
    total_engagements: int
    completed_engagements: int
    performance_rating: float | None
    assignments: list[PartnerEngagementHistoryItem] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# RM Portfolio Report (Class B — internal, MD review)
# ============================================================================


class RMClientProgramSummary(BaseModel):
    """Single program summary within an RM client view."""

    id: UUID
    title: str
    status: str
    rag_status: str
    start_date: date | None
    end_date: date | None
    budget_envelope: float | None
    milestone_count: int
    completed_milestone_count: int
    milestone_progress: float = Field(default=0.0, ge=0, le=100)


class RMClientSummary(BaseModel):
    """Per-client summary within the RM portfolio report."""

    client_id: UUID
    client_name: str
    client_type: str
    client_status: str
    total_programs: int
    active_programs: int
    completed_programs: int
    status_breakdown: dict[str, int] = Field(default_factory=dict)
    rag_summary: dict[str, int] = Field(default_factory=dict)
    milestone_completion_rate: float | None
    revenue_pipeline: float | None
    programs: list[RMClientProgramSummary] = Field(default_factory=list)


class RMPortfolioReport(BaseModel):
    """RM portfolio report for MD review — clients, programs, pipeline, satisfaction."""

    rm_id: UUID
    rm_name: str
    rm_email: str
    total_clients: int
    total_active_programs: int
    total_revenue_pipeline: float | None
    avg_nps_score: float | None
    clients: list[RMClientSummary] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Escalation Log Report (Class B — internal operational)
# ============================================================================


class EscalationLogItem(BaseModel):
    """Single escalation entry in the log report."""

    id: UUID
    title: str
    description: str | None
    level: str
    status: str
    entity_type: str
    entity_id: str
    program_id: UUID | None
    client_id: UUID | None
    owner_id: UUID
    owner_name: str | None
    owner_email: str | None
    triggered_at: datetime
    acknowledged_at: datetime | None
    resolved_at: datetime | None
    age_days: int
    resolution_time_days: float | None
    resolution_notes: str | None


class EscalationLogReport(BaseModel):
    """Escalation log report with resolution metrics."""

    total_escalations: int
    open_escalations: int
    avg_resolution_time_days: float | None
    escalations: list[EscalationLogItem] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Compliance Audit Report (Class B — internal operational)
# ============================================================================


class ClientKYCStatus(BaseModel):
    """KYC compliance status for a single client."""

    client_id: UUID
    client_name: str
    client_type: str
    total_documents: int
    current: int
    expiring_30d: int
    expired: int
    pending: int
    document_completeness_pct: float
    kyc_status: str  # "current" | "expiring" | "expired" | "pending" | "incomplete"


class AccessAnomalySummary(BaseModel):
    """Open finding from the most recent access audit."""

    id: UUID
    audit_period: str
    finding_type: str
    severity: str
    description: str
    status: str
    user_id: UUID | None


class UserAccountStatus(BaseModel):
    """User account status record for compliance review."""

    user_id: UUID
    full_name: str
    email: str
    role: str
    status: str
    created_at: datetime


class ComplianceAuditReport(BaseModel):
    """Compliance audit report covering KYC, access anomalies, and user accounts."""

    total_clients: int
    kyc_current: int
    kyc_expiring_30d: int
    kyc_expired: int
    client_kyc_statuses: list[ClientKYCStatus] = Field(default_factory=list)
    access_anomalies: list[AccessAnomalySummary] = Field(default_factory=list)
    latest_audit_period: str | None
    total_users: int
    active_users: int
    inactive_users: int
    deactivated_users: int
    user_account_statuses: list[UserAccountStatus] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)
