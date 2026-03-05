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
