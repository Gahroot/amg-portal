"""Pydantic schemas for KPI analytics endpoints."""

from pydantic import BaseModel


class KPIMetric(BaseModel):
    """A single KPI with current value, target, and status indicator."""

    label: str
    value: float | None
    target: float
    unit: str  # "score", "percent", "hours", "count", "rate"
    status: str  # "green", "yellow", "red"


class ClientExperienceKPIs(BaseModel):
    """Client experience dimension KPIs."""

    nps_score: KPIMetric
    report_on_time_rate: KPIMetric
    decision_response_time_hours: KPIMetric


class OperationalPerformanceKPIs(BaseModel):
    """Operational performance dimension KPIs."""

    milestone_on_time_rate: KPIMetric
    escalation_resolution_hours: KPIMetric
    deliverable_first_pass_rate: KPIMetric
    closure_completeness_rate: KPIMetric


class PartnerNetworkKPIs(BaseModel):
    """Partner network dimension KPIs."""

    avg_partner_score: KPIMetric
    sla_breach_rate: KPIMetric
    task_completion_rate: KPIMetric
    brief_to_acceptance_hours: KPIMetric


class ComplianceKPIs(BaseModel):
    """Security & compliance dimension KPIs."""

    kyc_currency_rate: KPIMetric
    unauthorized_access_incidents: KPIMetric
    audit_log_completeness: KPIMetric
    access_review_completion_rate: KPIMetric


class AllKPIsResponse(BaseModel):
    """Combined response containing all four KPI dimensions."""

    client_experience: ClientExperienceKPIs
    operations: OperationalPerformanceKPIs
    partner_network: PartnerNetworkKPIs
    compliance: ComplianceKPIs
