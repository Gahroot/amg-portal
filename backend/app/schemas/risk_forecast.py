"""Risk forecast schemas — predictive at-risk alerts & health forecasting."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# ============================================================================
# Shared Types
# ============================================================================

RiskStatus = str  # "healthy" | "at_risk" | "critical"
TrendDirection = str  # "improving" | "stable" | "declining"


# ============================================================================
# Risk Score Components
# ============================================================================


class RiskFactors(BaseModel):
    """Individual risk signal scores that compose the overall risk score."""

    overdue_task_ratio: float = Field(default=0.0, ge=0, le=1)
    sla_breach_count: int = Field(default=0, ge=0)
    open_escalation_count: int = Field(default=0, ge=0)
    budget_variance: float = Field(default=0.0, description="Negative = over budget")
    avg_nps_score: float | None = Field(default=None, ge=0, le=10)


class RiskScoreResponse(BaseModel):
    """Risk score for a single program."""

    program_id: UUID
    program_title: str
    client_id: UUID
    client_name: str
    risk_score: float = Field(ge=0, le=100)
    risk_status: RiskStatus
    trend: TrendDirection
    factors: RiskFactors
    program_status: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Program Health Summary (detail view)
# ============================================================================


class ProgramHealthSummary(BaseModel):
    """Extended health detail for a single program."""

    program_id: UUID
    program_title: str
    client_id: UUID
    client_name: str

    # Score
    risk_score: float = Field(ge=0, le=100)
    risk_status: RiskStatus
    trend: TrendDirection

    # Factor breakdown
    factors: RiskFactors

    # Task metrics
    total_tasks: int = 0
    overdue_tasks: int = 0

    # SLA metrics
    total_sla_trackers: int = 0
    breached_sla_count: int = 0

    # Escalation metrics
    open_escalations: int = 0

    # Budget
    budget_envelope: float | None = None
    budget_consumed: float | None = None

    # NPS
    latest_nps_score: float | None = None

    program_status: str
    start_date: str | None = None
    end_date: str | None = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# List Response
# ============================================================================


class RiskForecastListResponse(BaseModel):
    """Paginated list of program risk scores."""

    programs: list[RiskScoreResponse] = Field(default_factory=list)
    total: int = 0
    healthy_count: int = 0
    at_risk_count: int = 0
    critical_count: int = 0


# ============================================================================
# Client Risk Overview
# ============================================================================


class ClientRiskOverview(BaseModel):
    """Aggregated risk view across all programs for a client."""

    client_id: UUID
    client_name: str
    total_programs: int = 0
    healthy_count: int = 0
    at_risk_count: int = 0
    critical_count: int = 0
    avg_risk_score: float = Field(default=0.0, ge=0, le=100)
    highest_risk_program: RiskScoreResponse | None = None
    programs: list[RiskScoreResponse] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Alert Item
# ============================================================================


class RiskAlertItem(BaseModel):
    """A single high-risk alert needing attention."""

    program_id: UUID
    program_title: str
    client_id: UUID
    client_name: str
    risk_score: float = Field(ge=0, le=100)
    risk_status: RiskStatus
    trend: TrendDirection
    primary_driver: str
    factors: RiskFactors
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RiskAlertListResponse(BaseModel):
    """List of high-risk alerts."""

    alerts: list[RiskAlertItem] = Field(default_factory=list)
    total: int = 0


# ============================================================================
# Predictive Risk Alerts
# ============================================================================


class MilestoneBreachPrediction(BaseModel):
    """Predicted breach for a single milestone."""

    milestone_id: UUID
    milestone_title: str
    due_date: str | None = None
    days_until_breach: int
    completion_pct: float = Field(ge=0, le=100)
    predicted_completion_pct_at_due: float = Field(ge=0, le=100)
    risk_level: str  # "warning" (7-day) | "critical" (3-day)


class PredictiveRiskAlert(BaseModel):
    """Predictive risk alert for a program — issued before milestones are breached."""

    program_id: UUID
    program_title: str
    client_id: UUID
    client_name: str
    risk_score: float = Field(ge=0, le=100)
    risk_status: RiskStatus
    task_velocity: float = Field(
        default=0.0, description="Tasks completed per week"
    )
    tasks_remaining: int = 0
    milestone_predictions: list[MilestoneBreachPrediction] = Field(
        default_factory=list
    )
    earliest_breach_days: int | None = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PredictiveRiskListResponse(BaseModel):
    """List of programs with predicted milestone breaches."""

    alerts: list[PredictiveRiskAlert] = Field(default_factory=list)
    total: int = 0
    warning_count: int = 0
    critical_count: int = 0
