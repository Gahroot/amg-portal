"""Partner scoring service — aggregates partner ratings and rankings."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.partner import PartnerProfile
from app.models.partner_assignment import PartnerAssignment
from app.models.partner_governance import PartnerGovernance
from app.models.partner_rating import PartnerRating
from app.models.performance_notice import PerformanceNotice
from app.models.sla_tracker import SLATracker


async def calculate_partner_score(
    db: AsyncSession,
    partner_id: uuid.UUID,
) -> dict[str, Any]:
    """Aggregate all ratings for a partner."""
    result = await db.execute(
        select(
            func.avg(PartnerRating.quality_score).label("avg_quality"),
            func.avg(PartnerRating.timeliness_score).label("avg_timeliness"),
            func.avg(PartnerRating.communication_score).label("avg_communication"),
            func.avg(PartnerRating.overall_score).label("avg_overall"),
            func.count(PartnerRating.id).label("total_ratings"),
        ).where(PartnerRating.partner_id == partner_id)
    )
    row = result.one()
    return {
        "avg_quality": round(float(row.avg_quality), 2) if row.avg_quality else None,
        "avg_timeliness": round(float(row.avg_timeliness), 2) if row.avg_timeliness else None,
        "avg_communication": round(float(row.avg_communication), 2)
        if row.avg_communication
        else None,
        "avg_overall": round(float(row.avg_overall), 2) if row.avg_overall else None,
        "total_ratings": row.total_ratings,
    }


async def get_partner_scorecard(
    db: AsyncSession,
    partner_id: uuid.UUID,
) -> dict[str, Any] | None:
    """Get full partner scorecard with ratings breakdown."""
    # Fetch partner profile
    partner_result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    partner = partner_result.scalar_one_or_none()
    if not partner:
        return None

    # Aggregate scores
    scores = await calculate_partner_score(db, partner_id)

    # Assignment stats
    assignment_result = await db.execute(
        select(
            func.count(PartnerAssignment.id).label("total"),
            func.count(
                case(
                    (PartnerAssignment.status == "completed", PartnerAssignment.id),
                )
            ).label("completed"),
            func.count(
                case(
                    (
                        PartnerAssignment.status.in_(["accepted", "in_progress", "dispatched"]),
                        PartnerAssignment.id,
                    ),
                )
            ).label("active"),
        ).where(PartnerAssignment.partner_id == partner_id)
    )
    arow = assignment_result.one()

    return {
        "partner_id": partner.id,
        "firm_name": partner.firm_name,
        "avg_quality": scores["avg_quality"],
        "avg_timeliness": scores["avg_timeliness"],
        "avg_communication": scores["avg_communication"],
        "avg_overall": scores["avg_overall"],
        "total_ratings": scores["total_ratings"],
        "total_assignments": arow.total,
        "completed_assignments": arow.completed,
        "active_assignments": arow.active,
    }


async def get_all_partner_rankings(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[dict[str, Any]], int]:
    """Get all partners ranked by overall score."""
    # Subquery for average scores
    score_sub = (
        select(
            PartnerRating.partner_id,
            func.avg(PartnerRating.overall_score).label("avg_overall"),
            func.count(PartnerRating.id).label("total_ratings"),
        )
        .group_by(PartnerRating.partner_id)
        .subquery()
    )

    # Subquery for assignment counts
    assign_sub = (
        select(
            PartnerAssignment.partner_id,
            func.count(PartnerAssignment.id).label("total_assignments"),
        )
        .group_by(PartnerAssignment.partner_id)
        .subquery()
    )

    # Main query: all partners left-joined with scores and assignments
    query = (
        select(
            PartnerProfile.id.label("partner_id"),
            PartnerProfile.firm_name,
            score_sub.c.avg_overall,
            score_sub.c.total_ratings,
            assign_sub.c.total_assignments,
        )
        .outerjoin(score_sub, PartnerProfile.id == score_sub.c.partner_id)
        .outerjoin(assign_sub, PartnerProfile.id == assign_sub.c.partner_id)
        .order_by(score_sub.c.avg_overall.desc().nulls_last())
    )

    # Total count
    count_result = await db.execute(select(func.count(PartnerProfile.id)))
    total = count_result.scalar_one()

    result = await db.execute(query.offset(skip).limit(limit))
    rows = result.all()

    rankings = [
        {
            "partner_id": row.partner_id,
            "firm_name": row.firm_name,
            "avg_overall": round(float(row.avg_overall), 2) if row.avg_overall else None,
            "total_ratings": row.total_ratings or 0,
            "total_assignments": row.total_assignments or 0,
        }
        for row in rows
    ]

    return rankings, total


async def get_partner_performance_history(
    db: AsyncSession,
    partner_id: uuid.UUID,
) -> list[dict[str, Any]]:
    """Get partner's rating history over time."""
    result = await db.execute(
        select(PartnerRating)
        .where(PartnerRating.partner_id == partner_id)
        .order_by(PartnerRating.created_at.asc())
    )
    ratings = result.scalars().all()

    return [
        {
            "rating_id": r.id,
            "program_id": r.program_id,
            "quality_score": r.quality_score,
            "timeliness_score": r.timeliness_score,
            "communication_score": r.communication_score,
            "overall_score": r.overall_score,
            "comments": r.comments,
            "created_at": r.created_at,
        }
        for r in ratings
    ]


async def get_current_governance_status(
    db: AsyncSession,
    partner_id: uuid.UUID,
) -> str:
    """Get the current governance status for a partner (latest non-expired action)."""
    now = datetime.now(UTC)
    result = await db.execute(
        select(PartnerGovernance)
        .where(
            PartnerGovernance.partner_id == partner_id,
            (PartnerGovernance.expiry_date.is_(None)) | (PartnerGovernance.expiry_date > now),
        )
        .order_by(PartnerGovernance.created_at.desc())
        .limit(1)
    )
    latest = result.scalar_one_or_none()
    if latest is None:
        return "good_standing"
    return str(latest.action)


async def calculate_composite_score(
    db: AsyncSession,
    partner_id: uuid.UUID,
) -> dict[str, Any]:
    """Calculate composite score combining ratings and SLA compliance."""
    # Get partner profile
    partner_result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    partner = partner_result.scalar_one_or_none()
    if not partner:
        return {}

    # Rating component
    scores = await calculate_partner_score(db, partner_id)
    avg_overall = scores["avg_overall"]
    total_ratings = scores["total_ratings"]

    # SLA component — join through PartnerProfile.user_id to SLATracker.assigned_to
    total_sla_tracked = 0
    total_sla_breached = 0
    sla_compliance_rate: float | None = None

    if partner.user_id:
        sla_result = await db.execute(
            select(
                func.count(SLATracker.id).label("total"),
                func.count(case((SLATracker.breach_status == "breached", SLATracker.id))).label(
                    "breached"
                ),
            ).where(SLATracker.assigned_to == partner.user_id)
        )
        sla_row = sla_result.one()
        total_sla_tracked = sla_row.total
        total_sla_breached = sla_row.breached
        if total_sla_tracked > 0:
            sla_compliance_rate = round((1 - total_sla_breached / total_sla_tracked) * 100, 2)
        else:
            sla_compliance_rate = 100.0

    # Composite: 60% rating + 40% SLA
    rating_component = (avg_overall * 20) if avg_overall else None  # scale 1-5 → 0-100
    sla_component = sla_compliance_rate

    composite_score: float | None = None
    if rating_component is not None and sla_component is not None:
        composite_score = round(0.6 * rating_component + 0.4 * sla_component, 2)
    elif rating_component is not None:
        composite_score = round(rating_component, 2)
    elif sla_component is not None:
        composite_score = round(sla_component, 2)

    # Get current governance status
    current_status = await get_current_governance_status(db, partner_id)

    # Determine recommended action
    recommended = evaluate_recommended_action(composite_score, current_status)

    return {
        "partner_id": partner.id,
        "firm_name": partner.firm_name,
        "avg_rating_score": avg_overall,
        "sla_compliance_rate": sla_compliance_rate,
        "composite_score": composite_score,
        "total_ratings": total_ratings,
        "total_sla_tracked": total_sla_tracked,
        "total_sla_breached": total_sla_breached,
        "recommended_action": recommended,
        "current_governance_status": current_status,
    }


def evaluate_recommended_action(
    composite_score: float | None,
    current_status: str,
) -> str | None:
    """Determine recommended governance action based on composite score."""
    if composite_score is None:
        return None
    if composite_score < 20 and current_status not in ("suspension", "termination"):
        return "suspension"
    if composite_score < 40 and current_status not in ("probation", "suspension", "termination"):
        return "probation"
    if composite_score < 60 and current_status not in (
        "warning",
        "probation",
        "suspension",
        "termination",
    ):
        return "warning"
    return None


async def apply_governance_action(
    db: AsyncSession,
    partner_id: uuid.UUID,
    action: str,
    reason: str,
    issued_by: uuid.UUID,
    evidence: dict[str, Any] | None = None,
    expiry_date: datetime | None = None,
    effective_date: datetime | None = None,
) -> PartnerGovernance:
    """Create a governance action record and update partner status if needed."""
    record = PartnerGovernance(
        partner_id=partner_id,
        action=action,
        reason=reason,
        evidence=evidence,
        effective_date=effective_date or datetime.now(UTC),
        expiry_date=expiry_date,
        issued_by=issued_by,
    )
    db.add(record)

    # Update partner profile status for severe actions
    partner_result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    partner = partner_result.scalar_one_or_none()
    if partner:
        if action in ("suspension", "termination"):
            partner.status = "suspended"  # type: ignore[assignment]
        elif action == "reinstatement":
            partner.status = "active"  # type: ignore[assignment]

    await db.commit()
    await db.refresh(record)
    return record


async def get_governance_history(
    db: AsyncSession,
    partner_id: uuid.UUID,
) -> list[PartnerGovernance]:
    """Get all governance actions for a partner, newest first."""
    result = await db.execute(
        select(PartnerGovernance)
        .where(PartnerGovernance.partner_id == partner_id)
        .order_by(PartnerGovernance.created_at.desc())
    )
    return list(result.scalars().all())


async def get_governance_dashboard(  # noqa: PLR0912, PLR0915
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[dict[str, Any]], int]:
    """Get governance dashboard with all partners, their scores, and status.

    Uses 6 batch queries instead of per-partner round-trips to avoid N+7 query explosion.
    """
    # --- Query 1: total partner count ---
    count_result = await db.execute(select(func.count(PartnerProfile.id)))
    total = count_result.scalar_one()

    # --- Query 2: partners page ---
    partner_result = await db.execute(
        select(PartnerProfile).order_by(PartnerProfile.firm_name).offset(skip).limit(limit)
    )
    partners = partner_result.scalars().all()

    if not partners:
        return [], total

    partner_ids = [p.id for p in partners]
    user_ids = [p.user_id for p in partners if p.user_id is not None]

    # --- Query 3: rating aggregates for all partners in page ---
    rating_rows = await db.execute(
        select(
            PartnerRating.partner_id,
            func.avg(PartnerRating.quality_score).label("avg_quality"),
            func.avg(PartnerRating.timeliness_score).label("avg_timeliness"),
            func.avg(PartnerRating.communication_score).label("avg_communication"),
            func.avg(PartnerRating.overall_score).label("avg_overall"),
            func.count(PartnerRating.id).label("total_ratings"),
        )
        .where(PartnerRating.partner_id.in_(partner_ids))
        .group_by(PartnerRating.partner_id)
    )
    rating_by_pid: dict[Any, Any] = {row.partner_id: row for row in rating_rows.all()}

    # --- Query 4: SLA aggregates keyed by user_id ---
    sla_by_uid: dict[Any, Any] = {}
    if user_ids:
        sla_rows = await db.execute(
            select(
                SLATracker.assigned_to,
                func.count(SLATracker.id).label("total"),
                func.count(case((SLATracker.breach_status == "breached", SLATracker.id))).label(
                    "breached"
                ),
            )
            .where(SLATracker.assigned_to.in_(user_ids))
            .group_by(SLATracker.assigned_to)
        )
        sla_by_uid = {row.assigned_to: row for row in sla_rows.all()}

    # --- Query 5: all governance rows for the page (fetch all, process in-memory) ---
    gov_rows_result = await db.execute(
        select(PartnerGovernance)
        .where(PartnerGovernance.partner_id.in_(partner_ids))
        .order_by(PartnerGovernance.partner_id, PartnerGovernance.created_at.desc())
    )
    gov_rows_all = gov_rows_result.scalars().all()

    # Build per-partner governance lookups
    now = datetime.now(UTC)
    latest_gov_by_pid: dict[Any, PartnerGovernance] = {}  # latest overall (no expiry filter)
    active_gov_by_pid: dict[Any, PartnerGovernance] = {}  # latest non-expired (for status)
    for gov in gov_rows_all:
        pid = gov.partner_id
        # latest overall: rows are ordered DESC so first encountered wins
        if pid not in latest_gov_by_pid:
            latest_gov_by_pid[pid] = gov
        # latest non-expired: first non-expired row per partner
        if pid not in active_gov_by_pid and (gov.expiry_date is None or gov.expiry_date > now):
            active_gov_by_pid[pid] = gov

    # --- Query 6: notice counts for all partners in page ---
    notice_rows = await db.execute(
        select(
            PerformanceNotice.partner_id,
            func.count(PerformanceNotice.id).label("cnt"),
        )
        .where(PerformanceNotice.partner_id.in_(partner_ids))
        .group_by(PerformanceNotice.partner_id)
    )
    notice_by_pid: dict[Any, int] = {row.partner_id: row.cnt for row in notice_rows.all()}

    # --- In-memory assembly ---
    entries: list[dict[str, Any]] = []
    for partner in partners:
        pid = partner.id

        # Rating component
        r = rating_by_pid.get(pid)
        avg_overall = round(float(r.avg_overall), 2) if (r and r.avg_overall) else None

        # SLA component
        total_sla_tracked = 0
        total_sla_breached = 0
        sla_compliance_rate: float | None = None
        if partner.user_id:
            s = sla_by_uid.get(partner.user_id)
            if s:
                total_sla_tracked = s.total
                total_sla_breached = s.breached
            if total_sla_tracked > 0:
                sla_compliance_rate = round((1 - total_sla_breached / total_sla_tracked) * 100, 2)
            else:
                sla_compliance_rate = 100.0

        # Composite score: 60% rating + 40% SLA
        rating_component = (avg_overall * 20) if avg_overall is not None else None
        composite_score: float | None = None
        if rating_component is not None and sla_compliance_rate is not None:
            composite_score = round(0.6 * rating_component + 0.4 * sla_compliance_rate, 2)
        elif rating_component is not None:
            composite_score = round(rating_component, 2)
        elif sla_compliance_rate is not None:
            composite_score = round(sla_compliance_rate, 2)

        # Latest governance for display (no expiry filter)
        latest_gov = latest_gov_by_pid.get(pid)

        # Latest non-expired governance for recommended-action evaluation
        active_gov = active_gov_by_pid.get(pid)
        current_governance_status = str(active_gov.action) if active_gov else "good_standing"
        recommended_action = evaluate_recommended_action(composite_score, current_governance_status)

        entries.append(
            {
                "partner_id": pid,
                "firm_name": partner.firm_name,
                "composite_score": composite_score,
                "current_action": latest_gov.action if latest_gov else None,
                "current_action_date": (
                    latest_gov.effective_date.isoformat() if latest_gov else None
                ),
                "current_governance_status": current_governance_status,
                "recommended_action": recommended_action,
                "sla_breach_count": total_sla_breached,
                "avg_rating": avg_overall,
                "notice_count": notice_by_pid.get(pid, 0),
            }
        )

    return entries, total
