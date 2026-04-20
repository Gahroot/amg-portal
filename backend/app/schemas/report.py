"""Report schemas — client-facing and internal operational reports."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.base import Str50, Str100, Str255, Str2000

# ============================================================================
# Shared Components
# ============================================================================


class ReportMilestone(BaseModel):
    """Milestone summary for reports."""

    id: UUID
    title: Str255
    description: Str2000 | None
    due_date: date | None
    status: Str50
    position: int


class ReportDeliverable(BaseModel):
    """Deliverable summary for reports."""

    id: UUID
    title: Str255
    deliverable_type: Str50
    description: Str2000 | None
    due_date: date | None
    status: Str50
    client_visible: bool
    submitted_at: datetime | None
    reviewed_at: datetime | None


class ReportPartner(BaseModel):
    """Partner summary for reports."""

    id: UUID
    firm_name: Str255
    contact_name: Str255
    contact_email: Str255


class ReportPendingDecision(BaseModel):
    """Pending client decision for reports."""

    id: UUID
    title: Str255
    description: Str2000 | None
    requested_at: datetime
    deadline: datetime | None


# ============================================================================
# Portfolio Overview Report
# ============================================================================


class PortfolioProgramSummary(BaseModel):
    """Single program summary in portfolio."""

    id: UUID
    title: Str255
    status: Str50
    rag_status: Str50
    start_date: date | None
    end_date: date | None
    budget_envelope: Decimal | None
    milestone_count: int
    completed_milestone_count: int
    milestone_progress: float = Field(default=0.0, ge=0, le=100)


class PortfolioOverviewReport(BaseModel):
    """Portfolio overview report showing all client programs."""

    client_id: UUID
    client_name: Str255
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
    program_title: Str255
    program_status: Str50
    rag_status: Str50
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
    title: Str255
    planned_due_date: date | None
    actual_completed_at: datetime | None
    status: Str50
    on_time: bool | None = None  # None if not completed


class CompletionReport(BaseModel):
    """Program completion report with outcomes and timeline adherence."""

    program_id: UUID
    program_title: Str255
    client_id: UUID
    client_name: Str255
    objectives: Str2000 | None
    scope: Str2000 | None

    # Timeline
    planned_start_date: date | None
    planned_end_date: date | None
    actual_start_date: date | None
    actual_end_date: date | None
    timeline_adherence: Str50 | None  # "on_time", "early", "late"

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
    title: Str255
    status: Str50
    start_date: date | None
    end_date: date | None
    budget_envelope: Decimal | None
    rag_status: Str50


class MonthlyProgramCount(BaseModel):
    """Program count by month."""

    month: int
    month_name: Str50
    new_programs: int
    completed_programs: int


class PartnerPerformanceSummary(BaseModel):
    """Partner performance summary for annual review."""

    partner_id: UUID
    firm_name: Str255
    total_assignments: int
    completed_assignments: int
    avg_performance_rating: float | None


class AnnualReviewReport(BaseModel):
    """Annual relationship review across all programs."""

    client_id: UUID
    client_name: Str255
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
    assignment_title: Str255
    status: Str50
    brief: Str2000 | None
    sla_terms: Str2000 | None
    due_date: date | None
    accepted_at: datetime | None
    program_title: Str255 | None
    coordinator_name: Str255 | None
    coordinator_email: Str255 | None


class PartnerBriefSummaryReport(BaseModel):
    """Active brief summary — active assignments with tasks, deadlines, coordinator contact."""

    partner_id: UUID
    firm_name: Str255
    total_active: int
    assignments: list[PartnerBriefSummaryItem] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class PartnerDeliverableFeedbackItem(BaseModel):
    """Single deliverable feedback entry."""

    deliverable_id: UUID
    title: Str255
    deliverable_type: Str50
    assignment_id: UUID
    assignment_title: Str255 | None
    status: Str50
    submitted_at: datetime | None
    reviewed_at: datetime | None
    review_comments: Str2000 | None
    due_date: date | None


class PartnerDeliverableFeedbackReport(BaseModel):
    """History of deliverable submissions with review status and reviewer comments."""

    partner_id: UUID
    firm_name: Str255
    total_deliverables: int
    deliverables: list[PartnerDeliverableFeedbackItem] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class PartnerEngagementHistoryItem(BaseModel):
    """Single engagement entry in the partner history report."""

    assignment_id: UUID
    title: Str255
    program_title: Str255 | None
    status: Str50
    created_at: datetime
    accepted_at: datetime | None
    completed_at: datetime | None
    due_date: date | None
    deliverable_count: int
    approved_deliverable_count: int


class PartnerEngagementHistoryReport(BaseModel):
    """All past engagements for the current partner with completion stats."""

    partner_id: UUID
    firm_name: Str255
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
    title: Str255
    status: Str50
    rag_status: Str50
    start_date: date | None
    end_date: date | None
    budget_envelope: float | None
    milestone_count: int
    completed_milestone_count: int
    milestone_progress: float = Field(default=0.0, ge=0, le=100)


class RMClientSummary(BaseModel):
    """Per-client summary within the RM portfolio report."""

    client_id: UUID
    client_name: Str255
    client_type: Str50
    client_status: Str50
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
    rm_name: Str255
    rm_email: Str255
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
    title: Str255
    description: Str2000 | None
    level: Str50
    status: Str50
    entity_type: Str50
    entity_id: Str100
    program_id: UUID | None
    client_id: UUID | None
    owner_id: UUID
    owner_name: Str255 | None
    owner_email: Str255 | None
    triggered_at: datetime
    acknowledged_at: datetime | None
    resolved_at: datetime | None
    age_days: int
    resolution_time_days: float | None
    resolution_notes: Str2000 | None


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
    client_name: Str255
    client_type: Str50
    total_documents: int
    current: int
    expiring_30d: int
    expired: int
    pending: int
    document_completeness_pct: float
    kyc_status: Str50  # "current" | "expiring" | "expired" | "pending" | "incomplete"


class AccessAnomalySummary(BaseModel):
    """Open finding from the most recent access audit."""

    id: UUID
    audit_period: Str50
    finding_type: Str50
    severity: Str50
    description: Str2000
    status: Str50
    user_id: UUID | None


class UserAccountStatus(BaseModel):
    """User account status record for compliance review."""

    user_id: UUID
    full_name: Str255
    email: Str255
    role: Str50
    status: Str50
    created_at: datetime


class ComplianceAuditReport(BaseModel):
    """Compliance audit report covering KYC, access anomalies, and user accounts."""

    total_clients: int
    kyc_current: int
    kyc_expiring_30d: int
    kyc_expired: int
    client_kyc_statuses: list[ClientKYCStatus] = Field(default_factory=list)
    access_anomalies: list[AccessAnomalySummary] = Field(default_factory=list)
    latest_audit_period: Str50 | None
    total_users: int
    active_users: int
    inactive_users: int
    deactivated_users: int
    user_account_statuses: list[UserAccountStatus] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)
