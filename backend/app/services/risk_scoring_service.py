"""Risk scoring service — computes per-program risk scores from health signals."""

import logging
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.escalation import Escalation
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.sla_tracker import SLATracker
from app.models.task import Task
from app.schemas.risk_forecast import (
    ClientRiskOverview,
    MilestoneBreachPrediction,
    PredictiveRiskAlert,
    PredictiveRiskListResponse,
    ProgramHealthSummary,
    RiskAlertItem,
    RiskAlertListResponse,
    RiskFactors,
    RiskForecastListResponse,
    RiskScoreResponse,
)

logger = logging.getLogger(__name__)

# ============================================================================
# Score classification thresholds
# ============================================================================

HEALTHY_MAX = 30
AT_RISK_MAX = 60

# Weight allocation (must sum to 100)
WEIGHT_OVERDUE_TASKS = 25
WEIGHT_SLA_BREACHES = 25
WEIGHT_ESCALATIONS = 20
WEIGHT_BUDGET = 15
WEIGHT_NPS = 15


def _classify(score: float) -> str:
    if score <= HEALTHY_MAX:
        return "healthy"
    elif score <= AT_RISK_MAX:
        return "at_risk"
    return "critical"


def _compute_risk_score(factors: RiskFactors) -> float:
    """Compute a 0-100 risk score from individual factor signals."""
    # Overdue task ratio (0-1 → 0-25)
    overdue_component = min(factors.overdue_task_ratio, 1.0) * WEIGHT_OVERDUE_TASKS

    # SLA breaches: each breach adds points, capped
    sla_component = min(factors.sla_breach_count * 5, WEIGHT_SLA_BREACHES)

    # Escalations: each open escalation adds points, capped
    escalation_component = min(factors.open_escalation_count * 7, WEIGHT_ESCALATIONS)

    # Budget variance: negative = over budget.  -0.2 (20% over) => full weight
    if factors.budget_variance < 0:
        budget_component = min(abs(factors.budget_variance) / 0.2, 1.0) * WEIGHT_BUDGET
    else:
        budget_component = 0.0

    # NPS: low NPS drives risk.  Score < 5 = max risk.
    if factors.avg_nps_score is not None:
        nps_risk = max(0.0, 1.0 - factors.avg_nps_score / 7.0)
        nps_component = nps_risk * WEIGHT_NPS
    else:
        nps_component = 0.0  # no data = neutral

    total = (
        overdue_component + sla_component + escalation_component + budget_component + nps_component
    )
    return round(min(total, 100.0), 1)


def _determine_primary_driver(factors: RiskFactors) -> str:
    """Return the dominant risk factor label."""
    components = {
        "overdue_tasks": min(factors.overdue_task_ratio, 1.0) * WEIGHT_OVERDUE_TASKS,
        "sla_breaches": min(factors.sla_breach_count * 5, WEIGHT_SLA_BREACHES),
        "escalations": min(factors.open_escalation_count * 7, WEIGHT_ESCALATIONS),
        "budget_overrun": (
            min(abs(factors.budget_variance) / 0.2, 1.0) * WEIGHT_BUDGET
            if factors.budget_variance < 0
            else 0.0
        ),
        "low_nps": (
            max(0.0, 1.0 - factors.avg_nps_score / 7.0) * WEIGHT_NPS
            if factors.avg_nps_score is not None
            else 0.0
        ),
    }
    return max(components, key=components.get)  # type: ignore[arg-type]


# ============================================================================
# Data fetching helpers
# ============================================================================


async def _get_task_metrics(
    db: AsyncSession,
    program_id: UUID,
) -> tuple[int, int]:
    """Return (total_tasks, overdue_tasks) for a program."""
    # Get milestone IDs for this program
    milestone_q = select(Milestone.id).where(Milestone.program_id == program_id)
    milestone_ids = (await db.execute(milestone_q)).scalars().all()

    if not milestone_ids:
        return 0, 0

    total_q = select(func.count()).select_from(Task).where(Task.milestone_id.in_(milestone_ids))
    total = (await db.execute(total_q)).scalar_one()

    today = date.today()
    overdue_q = (
        select(func.count())
        .select_from(Task)
        .where(
            Task.milestone_id.in_(milestone_ids),
            Task.status.notin_(["done", "cancelled"]),
            Task.due_date.isnot(None),
            Task.due_date < today,
        )
    )
    overdue = (await db.execute(overdue_q)).scalar_one()

    return total, overdue


async def _get_sla_metrics(
    db: AsyncSession,
    program_id: UUID,
) -> tuple[int, int]:
    """Return (total_sla_trackers, breached_count) for a program entity."""
    pid = str(program_id)
    total_q = (
        select(func.count())
        .select_from(SLATracker)
        .where(SLATracker.entity_type == "program", SLATracker.entity_id == pid)
    )
    total = (await db.execute(total_q)).scalar_one()

    breached_q = (
        select(func.count())
        .select_from(SLATracker)
        .where(
            SLATracker.entity_type == "program",
            SLATracker.entity_id == pid,
            SLATracker.breach_status == "breached",
        )
    )
    breached = (await db.execute(breached_q)).scalar_one()

    return total, breached


async def _get_escalation_count(db: AsyncSession, program_id: UUID) -> int:
    """Return count of open escalations for a program."""
    q = (
        select(func.count())
        .select_from(Escalation)
        .where(
            Escalation.program_id == program_id,
            Escalation.status.in_(["open", "acknowledged", "investigating"]),
        )
    )
    return (await db.execute(q)).scalar_one()


async def _get_budget_variance(program: Program) -> float:
    """Return budget variance as a fraction. Negative = over budget."""
    if not program.budget_envelope or float(program.budget_envelope) == 0:
        return 0.0
    # Without a dedicated spend tracking table, use 0.0 (neutral)
    # In a full implementation this would query actual spend
    return 0.0


async def _get_avg_nps(db: AsyncSession, client_id: UUID) -> float | None:
    """Return average recent NPS score for a client, or None.

    ClientProfile does not have a direct FK to Client, so we match
    by the relationship manager — Client.rm_id == ClientProfile.assigned_rm_id.
    If no match is found, returns None (neutral for scoring).
    """
    try:
        from app.models.client_profile import ClientProfile
        from app.models.nps_survey import NPSResponse

        client_q = select(Client.rm_id).where(Client.id == client_id)
        rm_id = (await db.execute(client_q)).scalar_one_or_none()
        if not rm_id:
            return None

        profile_q = select(ClientProfile.id).where(ClientProfile.assigned_rm_id == rm_id)
        profile_ids = (await db.execute(profile_q)).scalars().all()
        if not profile_ids:
            return None

        avg_q = select(func.avg(NPSResponse.score)).where(
            NPSResponse.client_profile_id.in_(profile_ids)
        )
        result = (await db.execute(avg_q)).scalar_one_or_none()
        return round(float(result), 1) if result is not None else None
    except Exception:
        logger.debug("NPS data unavailable for client %s", client_id)
        return None


# ============================================================================
# Public API
# ============================================================================


async def compute_program_risk(
    db: AsyncSession,
    program: Program,
    client: Client,
) -> tuple[RiskScoreResponse, ProgramHealthSummary]:
    """Compute risk score and health summary for one program."""
    total_tasks, overdue_tasks = await _get_task_metrics(db, program.id)
    total_sla, breached_sla = await _get_sla_metrics(db, program.id)
    open_escalations = await _get_escalation_count(db, program.id)
    budget_variance = await _get_budget_variance(program)
    avg_nps = await _get_avg_nps(db, client.id)

    overdue_ratio = overdue_tasks / total_tasks if total_tasks > 0 else 0.0

    factors = RiskFactors(
        overdue_task_ratio=round(overdue_ratio, 3),
        sla_breach_count=breached_sla,
        open_escalation_count=open_escalations,
        budget_variance=budget_variance,
        avg_nps_score=avg_nps,
    )

    risk_score = _compute_risk_score(factors)
    risk_status = _classify(risk_score)

    # Trend: without historical data stored, default to stable
    trend = "stable"

    now = datetime.now(UTC)

    score_response = RiskScoreResponse(
        program_id=program.id,
        program_title=program.title,
        client_id=client.id,
        client_name=client.name,
        risk_score=risk_score,
        risk_status=risk_status,
        trend=trend,
        factors=factors,
        program_status=program.status,
        updated_at=now,
    )

    budget_envelope_val = float(program.budget_envelope) if program.budget_envelope else None

    health_summary = ProgramHealthSummary(
        program_id=program.id,
        program_title=program.title,
        client_id=client.id,
        client_name=client.name,
        risk_score=risk_score,
        risk_status=risk_status,
        trend=trend,
        factors=factors,
        total_tasks=total_tasks,
        overdue_tasks=overdue_tasks,
        total_sla_trackers=total_sla,
        breached_sla_count=breached_sla,
        open_escalations=open_escalations,
        budget_envelope=budget_envelope_val,
        budget_consumed=None,
        latest_nps_score=avg_nps,
        program_status=program.status,
        start_date=str(program.start_date) if program.start_date else None,
        end_date=str(program.end_date) if program.end_date else None,
        updated_at=now,
    )

    return score_response, health_summary


async def get_all_program_risks(
    db: AsyncSession,
    *,
    risk_status_filter: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> RiskForecastListResponse:
    """Compute risk scores for all active programs."""
    q = (
        select(Program, Client)
        .join(Client, Program.client_id == Client.id)
        .where(Program.status.in_(["active", "in_progress", "intake", "planning"]))
        .order_by(Program.created_at.desc())
    )
    result = await db.execute(q)
    rows = result.all()

    all_scores: list[RiskScoreResponse] = []
    for program, client in rows:
        score_resp, _ = await compute_program_risk(db, program, client)
        all_scores.append(score_resp)

    # Filter by risk status if requested
    if risk_status_filter:
        all_scores = [s for s in all_scores if s.risk_status == risk_status_filter]

    total = len(all_scores)
    healthy = sum(1 for s in all_scores if s.risk_status == "healthy")
    at_risk = sum(1 for s in all_scores if s.risk_status == "at_risk")
    critical = sum(1 for s in all_scores if s.risk_status == "critical")

    # Sort by risk score descending (highest risk first)
    all_scores.sort(key=lambda s: s.risk_score, reverse=True)

    paginated = all_scores[skip : skip + limit]

    return RiskForecastListResponse(
        programs=paginated,
        total=total,
        healthy_count=healthy,
        at_risk_count=at_risk,
        critical_count=critical,
    )


async def get_program_health_detail(
    db: AsyncSession,
    program_id: UUID,
) -> ProgramHealthSummary | None:
    """Get detailed health summary for a single program."""
    result = await db.execute(
        select(Program, Client)
        .join(Client, Program.client_id == Client.id)
        .where(Program.id == program_id)
    )
    row = result.one_or_none()
    if not row:
        return None

    program, client = row
    _, health = await compute_program_risk(db, program, client)
    return health


async def get_client_risk_overview(
    db: AsyncSession,
    client_id: UUID,
) -> ClientRiskOverview | None:
    """Get aggregated risk view across all programs for a client."""
    client_result = await db.execute(select(Client).where(Client.id == client_id))
    client = client_result.scalar_one_or_none()
    if not client:
        return None

    q = select(Program).where(
        Program.client_id == client_id,
        Program.status.in_(["active", "in_progress", "intake", "planning"]),
    )
    result = await db.execute(q)
    programs = result.scalars().all()

    scores: list[RiskScoreResponse] = []
    for program in programs:
        score_resp, _ = await compute_program_risk(db, program, client)
        scores.append(score_resp)

    total = len(scores)
    healthy = sum(1 for s in scores if s.risk_status == "healthy")
    at_risk = sum(1 for s in scores if s.risk_status == "at_risk")
    critical = sum(1 for s in scores if s.risk_status == "critical")
    avg_score = round(sum(s.risk_score for s in scores) / total, 1) if total > 0 else 0.0

    # Highest risk program
    highest = max(scores, key=lambda s: s.risk_score) if scores else None

    return ClientRiskOverview(
        client_id=client.id,
        client_name=client.name,
        total_programs=total,
        healthy_count=healthy,
        at_risk_count=at_risk,
        critical_count=critical,
        avg_risk_score=avg_score,
        highest_risk_program=highest,
        programs=sorted(scores, key=lambda s: s.risk_score, reverse=True),
    )


async def get_risk_alerts(
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 50,
) -> RiskAlertListResponse:
    """Return at-risk and critical programs as alerts."""
    forecast = await get_all_program_risks(db, skip=0, limit=500)

    alerts: list[RiskAlertItem] = []
    for prog in forecast.programs:
        if prog.risk_status in ("at_risk", "critical"):
            alerts.append(
                RiskAlertItem(
                    program_id=prog.program_id,
                    program_title=prog.program_title,
                    client_id=prog.client_id,
                    client_name=prog.client_name,
                    risk_score=prog.risk_score,
                    risk_status=prog.risk_status,
                    trend=prog.trend,
                    primary_driver=_determine_primary_driver(prog.factors),
                    factors=prog.factors,
                    updated_at=prog.updated_at,
                )
            )

    # Already sorted by risk_score desc from get_all_program_risks
    total = len(alerts)
    paginated = alerts[skip : skip + limit]

    return RiskAlertListResponse(alerts=paginated, total=total)


# ============================================================================
# Predictive Risk — trend analysis & breach forecasting
# ============================================================================

# Look-back window for measuring task completion velocity
_VELOCITY_WINDOW_DAYS = 28


async def _get_task_velocity(
    db: AsyncSession,
    milestone_ids: list[UUID],
) -> float:
    """Return tasks completed per week over the last 28 days."""
    if not milestone_ids:
        return 0.0

    cutoff = datetime.now(UTC) - timedelta(days=_VELOCITY_WINDOW_DAYS)
    q = (
        select(func.count())
        .select_from(Task)
        .where(
            Task.milestone_id.in_(milestone_ids),
            Task.status.in_(["done", "cancelled"]),
            Task.updated_at >= cutoff,
        )
    )
    completed = (await db.execute(q)).scalar_one()
    weeks = _VELOCITY_WINDOW_DAYS / 7
    return round(completed / weeks, 2) if weeks > 0 else 0.0


async def _get_milestone_predictions(
    db: AsyncSession,
    program_id: UUID,
    task_velocity: float,
) -> list[MilestoneBreachPrediction]:
    """Predict which milestones risk breaching their due date."""
    today = date.today()

    milestone_q = select(Milestone).where(
        Milestone.program_id == program_id,
        Milestone.status.notin_(["completed", "cancelled"]),
    )
    milestones = (await db.execute(milestone_q)).scalars().all()

    predictions: list[MilestoneBreachPrediction] = []

    for ms in milestones:
        if ms.due_date is None:
            continue

        days_until_due = max((ms.due_date - today).days, 0)

        # Task stats for this milestone
        total_q = (
            select(func.count()).select_from(Task).where(Task.milestone_id == ms.id)
        )
        total_tasks = (await db.execute(total_q)).scalar_one()

        done_q = (
            select(func.count())
            .select_from(Task)
            .where(
                Task.milestone_id == ms.id,
                Task.status.in_(["done", "cancelled"]),
            )
        )
        done_tasks = (await db.execute(done_q)).scalar_one()

        remaining = total_tasks - done_tasks
        completion_pct = round((done_tasks / total_tasks) * 100, 1) if total_tasks > 0 else 0.0

        # Predict completion % at due date based on current velocity
        if total_tasks == 0:
            predicted_completion_at_due = 100.0
        elif task_velocity <= 0:
            predicted_completion_at_due = completion_pct
        else:
            weeks_left = max(days_until_due, 0) / 7
            predicted_additional = task_velocity * weeks_left
            predicted_done = done_tasks + predicted_additional
            predicted_completion_at_due = round(
                min((predicted_done / total_tasks) * 100, 100.0), 1
            )

        # Only flag milestones within 7-day window that won't finish in time
        if days_until_due > 7:
            continue
        if remaining == 0:
            continue
        if predicted_completion_at_due >= 100.0 and days_until_due > 0:
            continue

        risk_level = "critical" if days_until_due <= 3 else "warning"

        predictions.append(
            MilestoneBreachPrediction(
                milestone_id=ms.id,
                milestone_title=ms.title,
                due_date=str(ms.due_date),
                days_until_breach=max(days_until_due, 0),
                completion_pct=completion_pct,
                predicted_completion_pct_at_due=predicted_completion_at_due,
                risk_level=risk_level,
            )
        )

    # Sort by urgency: soonest breach first
    predictions.sort(key=lambda p: p.days_until_breach)
    return predictions


async def predict_program_risk(
    db: AsyncSession,
    program: Program,
    client: Client,
) -> PredictiveRiskAlert | None:
    """Compute predictive risk alert for a program using trend analysis.

    Returns ``None`` if no milestones are predicted to breach.
    """
    milestone_q = select(Milestone.id).where(Milestone.program_id == program.id)
    milestone_ids = list((await db.execute(milestone_q)).scalars().all())

    task_velocity = await _get_task_velocity(db, milestone_ids)
    predictions = await _get_milestone_predictions(db, program.id, task_velocity)

    if not predictions:
        return None

    # Compute current risk score for context
    score_resp, _ = await compute_program_risk(db, program, client)

    # Count remaining tasks across all milestones
    remaining_q = (
        select(func.count())
        .select_from(Task)
        .where(
            Task.milestone_id.in_(milestone_ids),
            Task.status.notin_(["done", "cancelled"]),
        )
    ) if milestone_ids else None
    tasks_remaining = (await db.execute(remaining_q)).scalar_one() if remaining_q else 0

    earliest = min(p.days_until_breach for p in predictions)

    return PredictiveRiskAlert(
        program_id=program.id,
        program_title=program.title,
        client_id=client.id,
        client_name=client.name,
        risk_score=score_resp.risk_score,
        risk_status=score_resp.risk_status,
        task_velocity=task_velocity,
        tasks_remaining=tasks_remaining,
        milestone_predictions=predictions,
        earliest_breach_days=earliest,
        updated_at=datetime.now(UTC),
    )


async def get_predictive_risk_alerts(
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 50,
) -> PredictiveRiskListResponse:
    """Return predictive risk alerts for all active programs."""
    q = (
        select(Program, Client)
        .join(Client, Program.client_id == Client.id)
        .where(Program.status.in_(["active", "in_progress", "intake", "planning"]))
        .order_by(Program.created_at.desc())
    )
    result = await db.execute(q)
    rows = result.all()

    alerts: list[PredictiveRiskAlert] = []
    for program, client in rows:
        alert = await predict_program_risk(db, program, client)
        if alert is not None:
            alerts.append(alert)

    # Sort by earliest breach
    alerts.sort(key=lambda a: a.earliest_breach_days if a.earliest_breach_days is not None else 999)

    total = len(alerts)
    warning_count = sum(
        1 for a in alerts
        if any(p.risk_level == "warning" for p in a.milestone_predictions)
        and not any(p.risk_level == "critical" for p in a.milestone_predictions)
    )
    critical_count = sum(
        1 for a in alerts
        if any(p.risk_level == "critical" for p in a.milestone_predictions)
    )

    paginated = alerts[skip : skip + limit]

    return PredictiveRiskListResponse(
        alerts=paginated,
        total=total,
        warning_count=warning_count,
        critical_count=critical_count,
    )
