"""Risk prediction service — task completion rate, milestone velocity, anomaly detection.

Algorithm overview
──────────────────
1. **Task completion rate** — % of tasks in "done" status for the program or milestone.
   Computed across all milestones so we get a program-level view as well as a
   per-milestone breakdown.

2. **Milestone velocity** — rolling average of days between consecutive milestone
   completions (sorted chronologically).  A simple expanding/sliding window mean
   gives us the expected cadence; the latest interval is compared against that
   baseline using a z-score.

3. **Anomaly detection (z-score)** — for both task-completion drop-offs and
   velocity degradation.  A z-score > 2.0 (|value - mean| / std_dev) is treated
   as a statistically significant anomaly and sets `behind_schedule = True`.

4. **Predictions are persisted** to the `predicted_risks` table so dashboards can
   trend risk over time without re-running the full calculation.
"""

import logging
import math
import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.milestone import Milestone
from app.models.predicted_risk import PredictedRisk
from app.models.program import Program
from app.models.task import Task

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

RISK_LOW = 30
RISK_MEDIUM = 55
RISK_HIGH = 75  # matches predictive_service.RISK_SCORE_HIGH

Z_SCORE_ANOMALY_THRESHOLD = 2.0  # std-deviations before we flag an anomaly
MOVING_WINDOW_SIZE = 5  # milestones in the velocity sliding window


# ─── Pure-Python statistical helpers (no numpy/pandas dependency) ──────────────


def _mean(values: list[float]) -> float:
    """Arithmetic mean; returns 0.0 for empty list."""
    return sum(values) / len(values) if values else 0.0


def _std_dev(values: list[float]) -> float:
    """Population standard deviation; returns 0.0 for lists shorter than 2."""
    if len(values) < 2:
        return 0.0
    mu = _mean(values)
    variance = sum((x - mu) ** 2 for x in values) / len(values)
    return math.sqrt(variance)


def _z_score(value: float, values: list[float]) -> float | None:
    """Z-score of *value* against the distribution in *values*.

    Returns None when there is insufficient data (std_dev == 0).
    """
    if len(values) < 2:
        return None
    mu = _mean(values)
    sigma = _std_dev(values)
    if sigma == 0.0:
        return None
    return (value - mu) / sigma


def _moving_average(values: list[float], window: int) -> list[float]:
    """Return the simple moving average of *values* with the given *window* size.

    For positions with fewer than *window* preceding points the average is
    computed over however many points are available (expanding window).
    """
    result: list[float] = []
    for i in range(len(values)):
        start = max(0, i - window + 1)
        segment = values[start : i + 1]
        result.append(_mean(segment))
    return result


def _risk_level(score: int) -> str:
    if score >= RISK_HIGH:
        return "critical" if score >= 85 else "high"
    if score >= RISK_MEDIUM:
        return "medium"
    return "low"


# ─── Milestone velocity helpers ────────────────────────────────────────────────


def _compute_velocity(completed_milestones: list[Milestone]) -> dict[str, Any]:
    """Compute milestone velocity metrics from a list of completed milestones.

    Returns a dict with:
    - velocity: float | None — current moving-average velocity (days/milestone)
    - trend: str — "improving" | "stable" | "degrading"
    - intervals: list[float] — raw day intervals between completions
    - moving_averages: list[float] — sliding-window averages
    - anomaly: bool — True if latest interval is a statistically significant outlier
    - z_score: float | None — z-score of the latest interval
    """
    if len(completed_milestones) < 2:
        return {
            "velocity": None,
            "trend": "stable",
            "intervals": [],
            "moving_averages": [],
            "anomaly": False,
            "z_score": None,
        }

    # Sort by updated_at as a proxy for completion date
    sorted_ms = sorted(completed_milestones, key=lambda m: m.updated_at)

    # Calculate day intervals between consecutive completions
    intervals: list[float] = []
    for i in range(1, len(sorted_ms)):
        delta = (sorted_ms[i].updated_at - sorted_ms[i - 1].updated_at).total_seconds()
        intervals.append(max(delta / 86400.0, 0.0))  # convert to days

    moving_avgs = _moving_average(intervals, MOVING_WINDOW_SIZE)

    # Current velocity = latest moving average
    current_velocity = moving_avgs[-1] if moving_avgs else None

    # Trend: compare last two moving averages
    if len(moving_avgs) >= 2:
        diff = moving_avgs[-1] - moving_avgs[-2]
        # Higher days-per-milestone = slower = degrading
        if diff > 1.0:
            trend = "degrading"
        elif diff < -1.0:
            trend = "improving"
        else:
            trend = "stable"
    else:
        trend = "stable"

    # Anomaly detection: is the latest interval an outlier?
    z = _z_score(intervals[-1], intervals[:-1]) if len(intervals) >= 2 else None
    anomaly = z is not None and z > Z_SCORE_ANOMALY_THRESHOLD

    return {
        "velocity": current_velocity,
        "trend": trend,
        "intervals": intervals,
        "moving_averages": moving_avgs,
        "anomaly": anomaly,
        "z_score": z,
    }


# ─── Task completion helpers ────────────────────────────────────────────────────


def _compute_task_completion(tasks: list[Task], today: date) -> dict[str, Any]:
    """Return task completion metrics for a list of Task ORM objects."""
    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == "done")
    blocked = sum(1 for t in tasks if t.status == "blocked")
    overdue = sum(
        1
        for t in tasks
        if t.due_date and t.due_date < today and t.status not in ("done", "cancelled")
    )
    rate = (completed / total * 100.0) if total > 0 else 0.0

    # Completion-rate anomaly: flag if rate is abnormally low relative to due tasks
    # Treat rate < 20% with 5+ total tasks as a potential anomaly
    completion_anomaly = total >= 5 and rate < 20.0

    return {
        "total": total,
        "completed": completed,
        "blocked": blocked,
        "overdue": overdue,
        "rate": rate,
        "anomaly": completion_anomaly,
    }


# ─── Schedule deviation ────────────────────────────────────────────────────────


def _schedule_variance(
    program: Program, milestone: Milestone | None, today: date
) -> dict[str, Any]:
    """Compute schedule variance for a milestone or the program overall.

    schedule_variance > 0  → ahead of schedule
    schedule_variance < 0  → behind schedule
    """
    target = milestone.due_date if milestone else program.end_date
    if target is None:
        return {"days_remaining": None, "variance": None, "behind": False}

    days_remaining = (target - today).days

    # Compute expected completion based on elapsed programme time
    start = program.start_date or program.created_at.date()
    total_span = (target - start).days
    elapsed = (today - start).days

    # variance = actual days remaining vs. expected days remaining
    expected_days_remaining = max(total_span - elapsed, 0)
    variance = float(days_remaining - expected_days_remaining)

    return {
        "days_remaining": days_remaining,
        "variance": variance,
        "behind": days_remaining < 0,
    }


# ─── Core prediction function ──────────────────────────────────────────────────


async def compute_program_risk(
    db: AsyncSession,
    program_id: uuid.UUID,
    milestone_id: uuid.UUID | None = None,
) -> PredictedRisk | None:
    """Compute and persist a risk prediction for a program (or a single milestone).

    Steps:
    1. Load program with milestones and tasks.
    2. Calculate task completion rate (program-wide or milestone-scoped).
    3. Derive milestone velocity from completed milestones.
    4. Run anomaly detection on velocity and completion rate.
    5. Compose a composite risk score (0–100).
    6. Persist as a `PredictedRisk` row and return it.

    Returns None if the program is not found.
    """
    # ── Load program ──────────────────────────────────────────────────────────
    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.milestones).selectinload(Milestone.tasks),
            selectinload(Program.client),
        )
        .where(Program.id == program_id)
    )
    program = result.scalar_one_or_none()

    if program is None:
        logger.warning("compute_program_risk: program %s not found", program_id)
        return None

    today = datetime.now(UTC).date()
    milestones: list[Milestone] = list(program.milestones or [])

    # ── Scope to a single milestone if requested ───────────────────────────────
    focal_milestone: Milestone | None = None
    if milestone_id:
        focal_milestone = next((m for m in milestones if m.id == milestone_id), None)
        if focal_milestone is None:
            logger.warning(
                "compute_program_risk: milestone %s not in program %s",
                milestone_id,
                program_id,
            )
            return None
        task_pool: list[Task] = list(focal_milestone.tasks or [])
    else:
        task_pool = [t for m in milestones for t in (m.tasks or [])]

    # ── 1. Task completion rate ────────────────────────────────────────────────
    task_metrics = _compute_task_completion(task_pool, today)

    # ── 2. Milestone velocity ─────────────────────────────────────────────────
    completed_milestones = [m for m in milestones if m.status == "completed"]
    velocity_metrics = _compute_velocity(completed_milestones)

    # ── 3. Schedule variance ──────────────────────────────────────────────────
    sched = _schedule_variance(program, focal_milestone, today)

    # ── 4. Composite risk score ───────────────────────────────────────────────
    score = _composite_score(task_metrics, velocity_metrics, sched)

    # ── 5. Anomaly flags ──────────────────────────────────────────────────────
    anomaly_flags: dict[str, Any] = {
        "velocity_anomaly": velocity_metrics["anomaly"],
        "velocity_z_score": velocity_metrics.get("z_score"),
        "completion_rate_anomaly": task_metrics["anomaly"],
        "behind_schedule": sched["behind"] or velocity_metrics["anomaly"],
    }

    # ── 6. Human-readable summary ─────────────────────────────────────────────
    summary = _build_summary(program, focal_milestone, task_metrics, velocity_metrics, sched, score)

    # ── 7. Persist ────────────────────────────────────────────────────────────
    prediction = PredictedRisk(
        id=uuid.uuid4(),
        program_id=program_id,
        milestone_id=milestone_id,
        risk_score=score,
        risk_level=_risk_level(score),
        task_completion_rate=task_metrics["rate"],
        total_tasks=task_metrics["total"],
        completed_tasks=task_metrics["completed"],
        blocked_tasks=task_metrics["blocked"],
        overdue_tasks=task_metrics["overdue"],
        milestone_velocity=velocity_metrics["velocity"],
        milestone_velocity_trend=velocity_metrics["trend"],
        days_remaining=sched["days_remaining"],
        schedule_variance=sched["variance"],
        behind_schedule="true" if anomaly_flags["behind_schedule"] else "false",
        anomaly_flags=anomaly_flags,
        summary=summary,
        computed_at=datetime.now(UTC),
    )
    db.add(prediction)
    await db.flush()
    await db.refresh(prediction)
    return prediction


def _composite_score(
    task_metrics: dict[str, Any],
    velocity_metrics: dict[str, Any],
    sched: dict[str, Any],
) -> int:
    """Return a composite risk score (0–100).

    Weighting:
    - Task completion gap (incomplete % of tasks)     → 40 pts max
    - Milestone velocity / trend anomaly              → 30 pts max
    - Schedule deviation (days behind)                → 20 pts max
    - Anomaly bonus (statistical outlier detected)    → 10 pts max
    """
    # Component 1: task incompletion (higher incomplete = higher risk)
    incomplete_pct = 100.0 - task_metrics["rate"]
    task_score = min(incomplete_pct / 100.0 * 40, 40)

    # Blocked and overdue tasks add extra weight
    task_score += min(task_metrics["blocked"] * 3, 10)
    task_score = min(task_score, 40)

    # Component 2: velocity
    velocity_score = 0
    if velocity_metrics["trend"] == "degrading":
        velocity_score = 20
    elif velocity_metrics["trend"] == "stable" and velocity_metrics["velocity"] is not None:
        velocity_score = 8
    # improving = 0

    if velocity_metrics["anomaly"]:
        velocity_score = min(velocity_score + 10, 30)

    velocity_score = min(velocity_score, 30)

    # Component 3: schedule
    schedule_score = 0
    days_remaining = sched.get("days_remaining")
    variance = sched.get("variance")
    if sched["behind"]:
        schedule_score = 20  # already overdue
    elif days_remaining is not None and variance is not None:
        if days_remaining < 0:
            schedule_score = 20
        elif variance < -7:
            schedule_score = 15  # significantly behind expected pace
        elif variance < 0:
            schedule_score = 8
        else:
            schedule_score = 0

    schedule_score = min(schedule_score, 20)

    # Component 4: anomaly bonus
    anomaly_bonus = 0
    if velocity_metrics["anomaly"]:
        anomaly_bonus += 5
    if task_metrics["anomaly"]:
        anomaly_bonus += 5
    anomaly_bonus = min(anomaly_bonus, 10)

    total = int(task_score + velocity_score + schedule_score + anomaly_bonus)
    return min(total, 100)


def _build_summary(
    program: Program,
    milestone: Milestone | None,
    task_metrics: dict[str, Any],
    velocity_metrics: dict[str, Any],
    sched: dict[str, Any],
    score: int,
) -> str:
    """Compose a human-readable risk narrative."""
    parts: list[str] = []
    scope = f"Milestone '{milestone.title}'" if milestone else f"Program '{program.title}'"

    if score >= 85:
        parts.append(f"{scope} is in CRITICAL risk state (score {score}/100).")
    elif score >= RISK_HIGH:
        parts.append(f"{scope} is HIGH risk (score {score}/100).")
    elif score >= RISK_MEDIUM:
        parts.append(f"{scope} is MEDIUM risk (score {score}/100).")
    else:
        parts.append(f"{scope} is LOW risk (score {score}/100).")

    rate = task_metrics["rate"]
    done = task_metrics["completed"]
    tot = task_metrics["total"]
    parts.append(f"Task completion rate: {rate:.1f}% ({done}/{tot} tasks done).")

    if task_metrics["blocked"] > 0:
        parts.append(f"{task_metrics['blocked']} task(s) are blocked.")
    if task_metrics["overdue"] > 0:
        parts.append(f"{task_metrics['overdue']} task(s) are overdue.")

    vel = velocity_metrics.get("velocity")
    if vel is not None:
        trend = velocity_metrics["trend"]
        parts.append(f"Milestone velocity: {vel:.1f} days/milestone (trend: {trend}).")
    if velocity_metrics["anomaly"]:
        parts.append(
            "⚠ Velocity anomaly detected — milestone completions are significantly slower"
            " than expected."
        )

    if sched["behind"]:
        parts.append("🔴 Past due date.")
    elif sched["days_remaining"] is not None:
        parts.append(f"{sched['days_remaining']} days remaining.")

    return " ".join(parts)


# ─── Query helpers ─────────────────────────────────────────────────────────────


async def get_latest_predictions(
    db: AsyncSession,
    program_id: uuid.UUID | None = None,
    min_risk_score: int = 0,
    limit: int = 50,
) -> list[PredictedRisk]:
    """Return the most-recent PredictedRisk records, optionally filtered by program."""
    query = (
        select(PredictedRisk)
        .where(PredictedRisk.risk_score >= min_risk_score)
        .order_by(PredictedRisk.computed_at.desc())
        .limit(limit)
    )
    if program_id:
        query = query.where(PredictedRisk.program_id == program_id)

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_programs_at_risk(
    db: AsyncSession,
    min_risk_score: int = RISK_HIGH,
    rm_program_ids: list[uuid.UUID] | None = None,
    limit: int = 50,
) -> list[PredictedRisk]:
    """Return the most-recent predictions for programs above the risk threshold.

    When *rm_program_ids* is supplied only those programs are considered (RM scope).
    Uses a sub-query to select only the latest prediction per program.
    """
    from sqlalchemy import func

    # Subquery: latest computed_at per program_id
    sub = (
        select(
            PredictedRisk.program_id,
            func.max(PredictedRisk.computed_at).label("latest_at"),
        )
        .where(PredictedRisk.risk_score >= min_risk_score)
        .group_by(PredictedRisk.program_id)
        .subquery()
    )

    query = (
        select(PredictedRisk)
        .join(
            sub,
            (PredictedRisk.program_id == sub.c.program_id)
            & (PredictedRisk.computed_at == sub.c.latest_at),
        )
        .order_by(PredictedRisk.risk_score.desc())
        .limit(limit)
    )

    if rm_program_ids is not None:
        query = query.where(PredictedRisk.program_id.in_(rm_program_ids))

    result = await db.execute(query)
    return list(result.scalars().all())
