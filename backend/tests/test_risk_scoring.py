"""Tests for risk scoring business logic (pure functions, no DB)."""

import pytest

from app.schemas.risk_forecast import RiskFactors
from app.services.risk_scoring_service import (
    AT_RISK_MAX,
    HEALTHY_MAX,
    WEIGHT_BUDGET,
    WEIGHT_ESCALATIONS,
    WEIGHT_NPS,
    WEIGHT_OVERDUE_TASKS,
    WEIGHT_SLA_BREACHES,
    _classify,
    _compute_risk_score,
    _determine_primary_driver,
)


class TestClassify:
    def test_healthy_at_zero(self) -> None:
        assert _classify(0) == "healthy"

    def test_healthy_at_threshold(self) -> None:
        assert _classify(HEALTHY_MAX) == "healthy"

    def test_at_risk_just_above_healthy(self) -> None:
        assert _classify(HEALTHY_MAX + 0.1) == "at_risk"

    def test_at_risk_at_threshold(self) -> None:
        assert _classify(AT_RISK_MAX) == "at_risk"

    def test_critical_above_at_risk(self) -> None:
        assert _classify(AT_RISK_MAX + 0.1) == "critical"

    def test_critical_at_100(self) -> None:
        assert _classify(100) == "critical"


class TestComputeRiskScore:
    def test_all_healthy_factors(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=0.0,
            sla_breach_count=0,
            open_escalation_count=0,
            budget_variance=0.0,
            avg_nps_score=10.0,
        )
        score = _compute_risk_score(factors)
        assert score == 0.0

    def test_max_overdue_tasks(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=1.0,
            sla_breach_count=0,
            open_escalation_count=0,
            budget_variance=0.0,
            avg_nps_score=None,
        )
        score = _compute_risk_score(factors)
        assert score == WEIGHT_OVERDUE_TASKS

    def test_overdue_ratio_capped_by_schema(self) -> None:
        """Schema enforces overdue_task_ratio <= 1.0,
        so capping in compute is redundant but safe."""
        from pydantic import ValidationError as PydanticValidationError

        with pytest.raises(PydanticValidationError):
            RiskFactors(overdue_task_ratio=1.5)

    def test_sla_breaches_scaling(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=0.0,
            sla_breach_count=3,
            open_escalation_count=0,
            budget_variance=0.0,
            avg_nps_score=None,
        )
        score = _compute_risk_score(factors)
        assert score == min(3 * 5, WEIGHT_SLA_BREACHES)

    def test_sla_breaches_capped(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=0.0,
            sla_breach_count=100,
            open_escalation_count=0,
            budget_variance=0.0,
            avg_nps_score=None,
        )
        score = _compute_risk_score(factors)
        assert score == WEIGHT_SLA_BREACHES

    def test_escalations_scaling(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=0.0,
            sla_breach_count=0,
            open_escalation_count=2,
            budget_variance=0.0,
            avg_nps_score=None,
        )
        score = _compute_risk_score(factors)
        assert score == min(2 * 7, WEIGHT_ESCALATIONS)

    def test_budget_over_20_percent(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=0.0,
            sla_breach_count=0,
            open_escalation_count=0,
            budget_variance=-0.2,
            avg_nps_score=None,
        )
        score = _compute_risk_score(factors)
        assert score == WEIGHT_BUDGET

    def test_budget_under_budget_no_risk(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=0.0,
            sla_breach_count=0,
            open_escalation_count=0,
            budget_variance=0.1,
            avg_nps_score=None,
        )
        score = _compute_risk_score(factors)
        assert score == 0.0

    def test_low_nps_adds_risk(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=0.0,
            sla_breach_count=0,
            open_escalation_count=0,
            budget_variance=0.0,
            avg_nps_score=0.0,
        )
        score = _compute_risk_score(factors)
        assert score == WEIGHT_NPS

    def test_high_nps_no_risk(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=0.0,
            sla_breach_count=0,
            open_escalation_count=0,
            budget_variance=0.0,
            avg_nps_score=7.0,
        )
        score = _compute_risk_score(factors)
        assert score == 0.0

    def test_nps_none_is_neutral(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=0.0,
            sla_breach_count=0,
            open_escalation_count=0,
            budget_variance=0.0,
            avg_nps_score=None,
        )
        score = _compute_risk_score(factors)
        assert score == 0.0

    def test_score_capped_at_100(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=1.0,
            sla_breach_count=100,
            open_escalation_count=100,
            budget_variance=-1.0,
            avg_nps_score=0.0,
        )
        score = _compute_risk_score(factors)
        assert score == 100.0

    def test_combined_moderate_risk(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=0.3,
            sla_breach_count=1,
            open_escalation_count=1,
            budget_variance=-0.05,
            avg_nps_score=5.0,
        )
        score = _compute_risk_score(factors)
        assert 0 < score < 100


class TestDeterminePrimaryDriver:
    def test_overdue_tasks_dominant(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=1.0,
            sla_breach_count=0,
            open_escalation_count=0,
            budget_variance=0.0,
            avg_nps_score=None,
        )
        assert _determine_primary_driver(factors) == "overdue_tasks"

    def test_sla_breaches_dominant(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=0.0,
            sla_breach_count=10,
            open_escalation_count=0,
            budget_variance=0.0,
            avg_nps_score=None,
        )
        assert _determine_primary_driver(factors) == "sla_breaches"

    def test_escalations_dominant(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=0.0,
            sla_breach_count=0,
            open_escalation_count=5,
            budget_variance=0.0,
            avg_nps_score=None,
        )
        assert _determine_primary_driver(factors) == "escalations"

    def test_budget_dominant(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=0.0,
            sla_breach_count=0,
            open_escalation_count=0,
            budget_variance=-0.5,
            avg_nps_score=None,
        )
        assert _determine_primary_driver(factors) == "budget_overrun"

    def test_nps_dominant(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=0.0,
            sla_breach_count=0,
            open_escalation_count=0,
            budget_variance=0.0,
            avg_nps_score=0.0,
        )
        assert _determine_primary_driver(factors) == "low_nps"
