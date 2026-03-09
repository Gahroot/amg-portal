"""Partner scoring service — aggregates partner ratings and rankings."""

import uuid
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.partner import PartnerProfile
from app.models.partner_assignment import PartnerAssignment
from app.models.partner_rating import PartnerRating


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
