"""Pydantic schemas for predictive risk endpoints."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

# ──────────────────────────────────────────────────────────────────────────────
# Milestone risk detail (used by the real-time calculate endpoint)
# ──────────────────────────────────────────────────────────────────────────────


class MilestoneRiskDetail(BaseModel):
    """Full risk breakdown for a single milestone, computed on-the-fly."""

    milestone_id: uuid.UUID
    milestone_title: str
    program_id: uuid.UUID
    program_title: str
    client_name: str
    risk_score: int
    risk_level: str
    days_remaining: int | None
    task_completion_rate: float
    partner_responsiveness_score: float | None
    sla_breach_rate: float
    risk_factors: dict[str, Any]


# ──────────────────────────────────────────────────────────────────────────────
# Predicted risks list
# ──────────────────────────────────────────────────────────────────────────────


class PredictedRiskItem(BaseModel):
    """Summary of a program that has at least one at-risk milestone."""

    program_id: uuid.UUID
    program_title: str
    client_name: str
    highest_risk_score: int
    risk_level: str
    at_risk_milestone_count: int
    at_risk_milestones: list[dict[str, Any]]


class PredictedRisksResponse(BaseModel):
    programs: list[PredictedRiskItem]
    total: int


# ──────────────────────────────────────────────────────────────────────────────
# Stored prediction (PredictedRisk model)
# ──────────────────────────────────────────────────────────────────────────────


class StoredRiskPrediction(BaseModel):
    """Response schema for a persisted PredictedRisk record."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    program_id: uuid.UUID
    milestone_id: uuid.UUID | None
    risk_score: int
    risk_level: str
    task_completion_rate: float
    total_tasks: int
    completed_tasks: int
    blocked_tasks: int
    overdue_tasks: int
    milestone_velocity: float | None
    milestone_velocity_trend: str | None
    days_remaining: int | None
    schedule_variance: float | None
    behind_schedule: str
    anomaly_flags: dict[str, Any] | None
    summary: str | None
    computed_at: datetime


class StoredRiskPredictionList(BaseModel):
    predictions: list[StoredRiskPrediction]
    total: int


# ──────────────────────────────────────────────────────────────────────────────
# Request to trigger a new prediction run
# ──────────────────────────────────────────────────────────────────────────────


class RunPredictionRequest(BaseModel):
    program_id: uuid.UUID
    milestone_id: uuid.UUID | None = None
