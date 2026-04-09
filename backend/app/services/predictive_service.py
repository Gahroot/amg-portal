"""Predictive analytics service for milestone risk scoring and capacity planning.

Per design doc Section 09 Phase 3:
"Predictive alerts and capacity planning tools — Program at-risk flags issued
before milestones are breached."

Section 10 KPIs:
"Program on-time milestone rate > 90%."
"""

import logging
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.escalation import Escalation
from app.models.milestone import Milestone
from app.models.partner_rating import PartnerRating
from app.models.program import Program
from app.models.sla_tracker import SLATracker
from app.models.task import Task
from app.models.user import User

logger = logging.getLogger(__name__)

# Risk score thresholds
RISK_SCORE_HIGH = 70  # "predicted at-risk" threshold
RISK_SCORE_CRITICAL = 85  # Immediate attention required

# Capacity planning constants
DEFAULT_WEEKLY_CAPACITY = 40  # hours per week
TASK_HOURS_ESTIMATE = 2  # estimated hours per task
MILESTONE_HOURS_ESTIMATE = 4  # estimated hours per milestone review


class MilestoneRiskScore(BaseModel):
    """Risk score breakdown for a milestone."""

    milestone_id: uuid.UUID
    milestone_title: str
    program_id: uuid.UUID
    program_title: str
    client_name: str
    risk_score: int
    days_remaining: int | None
    task_completion_rate: float
    partner_responsiveness_score: float | None
    sla_breach_rate: float
    risk_factors: dict[str, Any]


class CapacityForecastWeek(BaseModel):
    """Capacity forecast for a single week."""

    week_start: date
    week_end: date
    week_number: int
    projected_tasks: int
    projected_milestones: int
    estimated_hours: float
    capacity_hours: float
    utilization_percent: int
    status: str  # "available", "moderate", "high", "overloaded"


class CapacityForecast(BaseModel):
    """Capacity forecast for a user over multiple weeks."""

    user_id: str
    user_name: str
    user_role: str
    weekly_forecasts: list[CapacityForecastWeek]
    total_projected_hours: float
    average_utilization: int
    overload_weeks: list[int]


async def calculate_milestone_risk_score(  # noqa: PLR0912, PLR0915
    db: AsyncSession,
    milestone_id: uuid.UUID,
) -> MilestoneRiskScore | None:
    """Calculate a predictive risk score (0-100) for a milestone.

    Risk factors weighted as follows:
    - Days remaining vs. task completion rate (40%): Urgency vs. progress
    - Partner responsiveness history (25%): Historical partner SLA performance
    - Past SLA breach rate for partner/program (20%): Program-specific risk
    - Blocked/overdue tasks (15%): Current blockers

    Returns None if milestone not found or already completed.
    """
    # Fetch milestone with related data
    result = await db.execute(
        select(Milestone)
        .options(
            selectinload(Milestone.program).selectinload(Program.client),
            selectinload(Milestone.program).selectinload(Program.partner_assignments),
            selectinload(Milestone.tasks),
        )
        .where(Milestone.id == milestone_id)
    )
    milestone = result.scalar_one_or_none()

    if not milestone:
        logger.warning("Milestone %s not found", milestone_id)
        return None

    if milestone.status in ("completed", "cancelled"):
        return None

    program = milestone.program
    if not program:
        logger.warning("Milestone %s has no program", milestone_id)
        return None

    client_name = program.client.name if program.client else "Unknown"
    today = datetime.now(UTC).date()

    # === Factor 1: Days remaining vs. task completion rate (40 points max) ===
    days_remaining: int | None = None
    urgency_score = 0
    progress_score = 0

    if milestone.due_date:
        days_remaining = (milestone.due_date - today).days

        # Urgency scoring (more urgent = higher risk)
        if days_remaining < 0:
            urgency_score = 20  # Already overdue
        elif days_remaining <= 2:
            urgency_score = 18  # Critical
        elif days_remaining <= 7:
            urgency_score = 12  # Approaching
        elif days_remaining <= 14:
            urgency_score = 6  # Near-term
        else:
            urgency_score = 2  # Distant

    # Task completion rate scoring (lower completion = higher risk)
    tasks = milestone.tasks or []
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == "done")
    task_completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0.0

    # Invert completion rate for risk (high completion = low risk)
    # No tasks defined yet = moderate risk (10); otherwise scale inversely
    progress_score = 10 if total_tasks == 0 else int((100 - task_completion_rate) / 100 * 20)

    time_progress_score = urgency_score + progress_score  # Max 40

    # === Factor 2: Partner responsiveness history (25 points max) ===
    partner_responsiveness_score: float | None = None

    if program.partner_assignments:
        partner_ids = [pa.partner_id for pa in program.partner_assignments]

        # Get average timeliness scores from partner ratings
        if partner_ids:
            rating_result = await db.execute(
                select(func.avg(PartnerRating.timeliness_score))
                .where(PartnerRating.partner_id.in_(partner_ids))
            )
            avg_timeliness = rating_result.scalar_one_or_none()

            if avg_timeliness is not None:
                # Convert 1-5 scale to 0-25 risk score
                # Lower timeliness = higher risk
                partner_responsiveness_score = float(avg_timeliness)
                partner_risk = int((5 - avg_timeliness) / 4 * 25)
            else:
                # No ratings yet - assume moderate risk
                partner_risk = 12
        else:
            partner_risk = 5  # No partners assigned - lower risk
    else:
        partner_risk = 5  # No partners assigned - lower risk

    # === Factor 3: Past SLA breach rate for program (20 points max) ===
    # Check SLA breaches related to this program
    sla_result = await db.execute(
        select(func.count(SLATracker.id))
        .where(
            SLATracker.entity_id == str(program.id),
            SLATracker.breach_status == "breached",
        )
    )
    breached_slas = sla_result.scalar_one() or 0

    # Also check escalations for this program
    esc_result = await db.execute(
        select(func.count(Escalation.id))
        .where(
            Escalation.program_id == program.id,
            Escalation.status.in_(["open", "acknowledged", "investigating"]),
        )
    )
    active_escalations = esc_result.scalar_one() or 0

    # Combine into breach rate score
    breach_count = breached_slas + active_escalations
    sla_breach_rate = min(breach_count / 5, 1.0)  # Normalize to max 5 breaches
    sla_risk = int(sla_breach_rate * 20)

    # === Factor 4: Blocked/overdue tasks (15 points max) ===
    blocked_tasks = sum(1 for t in tasks if t.status == "blocked")
    overdue_tasks = sum(
        1 for t in tasks
        if t.due_date and t.due_date < today and t.status not in ("done", "cancelled")
    )

    blocker_risk = min((blocked_tasks * 5) + (overdue_tasks * 5), 15)

    # === Calculate total risk score ===
    total_risk = time_progress_score + partner_risk + sla_risk + blocker_risk
    risk_score = min(total_risk, 100)

    # Build risk factors breakdown
    risk_factors: dict[str, Any] = {
        "days_remaining": days_remaining,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "task_completion_rate": round(task_completion_rate, 1),
        "blocked_tasks": blocked_tasks,
        "overdue_tasks": overdue_tasks,
        "breached_slas": breached_slas,
        "active_escalations": active_escalations,
        "time_progress_score": time_progress_score,
        "partner_risk": partner_risk,
        "sla_risk": sla_risk,
        "blocker_risk": blocker_risk,
    }

    return MilestoneRiskScore(
        milestone_id=milestone.id,
        milestone_title=milestone.title,
        program_id=program.id,
        program_title=program.title,
        client_name=client_name,
        risk_score=risk_score,
        days_remaining=days_remaining,
        task_completion_rate=task_completion_rate,
        partner_responsiveness_score=partner_responsiveness_score,
        sla_breach_rate=sla_breach_rate,
        risk_factors=risk_factors,
    )


async def get_at_risk_milestones(
    db: AsyncSession,
    rm_client_ids: list[uuid.UUID] | None = None,
    min_risk_score: int = RISK_SCORE_HIGH,
) -> list[MilestoneRiskScore]:
    """Get all milestones with risk score above threshold.

    This is the core predictive function that flags programs at-risk
    BEFORE milestones are actually breached.

    Args:
        db: Database session
        rm_client_ids: Optional filter for RM-scoped access
        min_risk_score: Minimum risk score threshold (default 70)

    Returns:
        List of MilestoneRiskScore objects sorted by risk score descending
    """
    # Query active milestones with due dates
    query = (
        select(Milestone)
        .options(
            selectinload(Milestone.program).selectinload(Program.client),
        )
        .where(
            Milestone.status.notin_(["completed", "cancelled"]),
            Milestone.due_date.isnot(None),
        )
    )

    if rm_client_ids is not None:
        query = query.where(Milestone.program.has(Program.client_id.in_(rm_client_ids)))

    result = await db.execute(query)
    milestones = result.scalars().all()

    at_risk: list[MilestoneRiskScore] = []

    for milestone in milestones:
        risk = await calculate_milestone_risk_score(db, milestone.id)
        if risk and risk.risk_score >= min_risk_score:
            at_risk.append(risk)

    # Sort by risk score descending
    at_risk.sort(key=lambda r: r.risk_score, reverse=True)

    return at_risk


async def get_at_risk_programs(
    db: AsyncSession,
    rm_client_ids: list[uuid.UUID] | None = None,
) -> list[dict[str, Any]]:
    """Get programs with any milestone having risk_score > 70.

    Returns program-level summary with highest-risk milestone info.
    """
    at_risk_milestones = await get_at_risk_milestones(db, rm_client_ids)

    # Group by program
    programs_map: dict[uuid.UUID, dict[str, Any]] = {}

    for risk in at_risk_milestones:
        if risk.program_id not in programs_map:
            programs_map[risk.program_id] = {
                "program_id": risk.program_id,
                "program_title": risk.program_title,
                "client_name": risk.client_name,
                "highest_risk_score": 0,
                "at_risk_milestone_count": 0,
                "at_risk_milestones": [],
            }

        programs_map[risk.program_id]["at_risk_milestone_count"] += 1
        programs_map[risk.program_id]["at_risk_milestones"].append({
            "milestone_id": str(risk.milestone_id),
            "milestone_title": risk.milestone_title,
            "risk_score": risk.risk_score,
            "days_remaining": risk.days_remaining,
            "task_completion_rate": risk.task_completion_rate,
        })

        current_best = programs_map[risk.program_id]["highest_risk_score"]
        programs_map[risk.program_id]["highest_risk_score"] = max(current_best, risk.risk_score)

    # Sort by highest risk score
    programs = list(programs_map.values())
    programs.sort(key=lambda p: p["highest_risk_score"], reverse=True)

    return programs


async def get_capacity_forecast(
    db: AsyncSession,
    user_id: uuid.UUID,
    weeks: int = 4,
) -> CapacityForecast | None:
    """Calculate projected workload for the next N weeks for a user.

    Based on:
    - Upcoming milestones due in each week
    - Tasks assigned to the user with due dates
    - Active programs the user is responsible for

    Returns None if user not found.
    """
    # Fetch user
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    if not user:
        return None

    today = datetime.now(UTC).date()
    weekly_forecasts: list[CapacityForecastWeek] = []
    total_projected_hours = 0.0
    overload_weeks: list[int] = []

    for week_num in range(1, weeks + 1):
        week_start = today + timedelta(days=(week_num - 1) * 7)
        week_end = week_start + timedelta(days=6)

        # Count milestones due this week (where user created the program)
        milestone_result = await db.execute(
            select(func.count(Milestone.id))
            .select_from(Milestone)
            .join(Program, Milestone.program_id == Program.id)
            .where(
                Program.created_by == user_id,
                Milestone.due_date >= week_start,
                Milestone.due_date <= week_end,
                Milestone.status.notin_(["completed", "cancelled"]),
            )
        )
        milestone_count = milestone_result.scalar_one() or 0

        # Count tasks assigned to user due this week
        task_result = await db.execute(
            select(func.count(Task.id))
            .select_from(Task)
            .join(Milestone, Task.milestone_id == Milestone.id)
            .where(
                Task.assigned_to == user_id,
                Task.due_date >= week_start,
                Task.due_date <= week_end,
                Task.status.notin_(["done", "cancelled"]),
            )
        )
        task_count = task_result.scalar_one() or 0

        # Estimate hours
        estimated_hours = (
            milestone_count * MILESTONE_HOURS_ESTIMATE +
            task_count * TASK_HOURS_ESTIMATE
        )

        # Calculate utilization
        capacity_hours = DEFAULT_WEEKLY_CAPACITY
        utilization = int(min(estimated_hours / capacity_hours * 100, 150))

        # Determine status
        if utilization < 50:
            status = "available"
        elif utilization < 75:
            status = "moderate"
        elif utilization < 100:
            status = "high"
        else:
            status = "overloaded"
            overload_weeks.append(week_num)

        weekly_forecasts.append(CapacityForecastWeek(
            week_start=week_start,
            week_end=week_end,
            week_number=week_num,
            projected_tasks=task_count,
            projected_milestones=milestone_count,
            estimated_hours=estimated_hours,
            capacity_hours=capacity_hours,
            utilization_percent=utilization,
            status=status,
        ))

        total_projected_hours += estimated_hours

    # Calculate average utilization
    avg_utilization = int(sum(w.utilization_percent for w in weekly_forecasts) / weeks)

    return CapacityForecast(
        user_id=str(user.id),
        user_name=user.full_name,
        user_role=user.role,
        weekly_forecasts=weekly_forecasts,
        total_projected_hours=total_projected_hours,
        average_utilization=avg_utilization,
        overload_weeks=overload_weeks,
    )


async def get_all_capacity_forecasts(
    db: AsyncSession,
    weeks: int = 4,
) -> list[CapacityForecast]:
    """Get capacity forecasts for all internal staff members."""
    internal_roles = [
        "managing_director",
        "relationship_manager",
        "coordinator",
        "finance_compliance",
    ]

    users_result = await db.execute(
        select(User.id).where(
            User.role.in_(internal_roles),
            User.status == "active",
        )
    )
    user_ids = [row[0] for row in users_result.all()]

    forecasts: list[CapacityForecast] = []
    for user_id in user_ids:
        forecast = await get_capacity_forecast(db, user_id, weeks)
        if forecast:
            forecasts.append(forecast)

    return forecasts
