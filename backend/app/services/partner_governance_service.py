"""Partner governance — performance reviews, de-listing, capability refresh."""

import logging
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.capability_review import CapabilityReview
from app.models.notification import Notification
from app.models.partner import PartnerProfile
from app.models.partner_rating import PartnerRating
from app.models.user import User
from app.schemas.notification import CreateNotificationRequest
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)


async def _get_md_user_ids(db: AsyncSession) -> list[uuid.UUID]:
    """Get all active managing director user IDs."""
    result = await db.execute(
        select(User.id).where(
            User.role == "managing_director",
            User.status == "active",
        )
    )
    return list(result.scalars().all())


async def check_partner_performance(
    db: AsyncSession,
    partner_id: uuid.UUID,
) -> dict[str, Any]:
    """Evaluate a partner's performance after a rating is submitted.

    Steps:
    1. Calculate the average overall score across all ratings.
    2. Update PartnerProfile.performance_rating with the new average.
    3. If average < threshold, check for prior improvement-review notification
       in the last 12 months.
       - First offence: create an improvement-review notification to MDs.
       - Repeated offence (already flagged): trigger de-listing review notification.
    4. Return governance status dict.
    """
    # 1. Calculate averages
    agg_result = await db.execute(
        select(
            func.avg(PartnerRating.overall_score).label("avg_overall"),
            func.count(PartnerRating.id).label("total_ratings"),
        ).where(PartnerRating.partner_id == partner_id)
    )
    agg = agg_result.one()
    avg_overall: float | None = round(float(agg.avg_overall), 2) if agg.avg_overall else None
    total_ratings: int = agg.total_ratings or 0

    # 2. Update partner profile rating
    partner_result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id == partner_id)
    )
    partner = partner_result.scalar_one_or_none()
    if not partner:
        return {"error": "partner_not_found"}

    if avg_overall is not None:
        partner.performance_rating = avg_overall  # type: ignore[assignment]

    governance_action: str | None = None

    # 3. Check if below threshold
    threshold = settings.PARTNER_MIN_PERFORMANCE_SCORE
    if avg_overall is not None and avg_overall < threshold:
        # Check for an existing improvement-review notification in the last 12 months
        twelve_months_ago = datetime.now(UTC) - timedelta(days=365)
        prior_flag_result = await db.execute(
            select(func.count()).where(
                Notification.title.ilike("%improvement review%"),
                Notification.body.ilike(f"%{partner.firm_name}%"),
                Notification.created_at >= twelve_months_ago,
            )
        )
        prior_flags = prior_flag_result.scalar_one()

        md_ids = await _get_md_user_ids(db)

        if prior_flags > 0:
            # Already flagged once — trigger de-listing review
            governance_action = "delisting_review"
            for md_id in md_ids:
                await notification_service.create_notification(
                    db,
                    CreateNotificationRequest(
                        user_id=md_id,
                        notification_type="system",
                        title=f"De-listing review: {partner.firm_name}",
                        body=(
                            f"Partner {partner.firm_name} has an average overall score of "
                            f"{avg_overall}/5.0 (threshold: {threshold}). "
                            f"This partner was already flagged for an improvement review "
                            f"in the last 12 months. A de-listing review is recommended."
                        ),
                        priority="urgent",
                        action_url=f"/partners/{partner.id}",
                        action_label="Review Partner",
                    ),
                )
        else:
            # First offence — improvement review
            governance_action = "improvement_review"
            for md_id in md_ids:
                await notification_service.create_notification(
                    db,
                    CreateNotificationRequest(
                        user_id=md_id,
                        notification_type="system",
                        title=f"Partner improvement review: {partner.firm_name}",
                        body=(
                            f"Partner {partner.firm_name} has an average overall score of "
                            f"{avg_overall}/5.0, which is below the minimum threshold "
                            f"of {threshold}. An improvement review is recommended."
                        ),
                        priority="high",
                        action_url=f"/partners/{partner.id}",
                        action_label="Review Partner",
                    ),
                )

    await db.commit()

    return {
        "partner_id": partner_id,
        "avg_overall": avg_overall,
        "total_ratings": total_ratings,
        "threshold": threshold,
        "governance_action": governance_action,
    }


async def check_probationary_partners(db: AsyncSession) -> list[dict[str, Any]]:
    """Identify partners below the probationary engagement count and flag them.

    Partners with fewer than PARTNER_PROBATION_ENGAGEMENT_COUNT total_assignments
    and an active status are considered probationary.
    """
    probation_count = settings.PARTNER_PROBATION_ENGAGEMENT_COUNT
    result = await db.execute(
        select(PartnerProfile).where(
            PartnerProfile.status == "active",
            PartnerProfile.total_assignments < probation_count,
        )
    )
    partners = result.scalars().all()

    flagged: list[dict[str, Any]] = []
    for partner in partners:
        flagged.append({
            "partner_id": partner.id,
            "firm_name": partner.firm_name,
            "total_assignments": partner.total_assignments,
            "status": "probationary",
        })

    logger.info(
        "Probationary partner check complete — %d partners flagged",
        len(flagged),
    )
    return flagged


async def trigger_annual_capability_refresh(db: AsyncSession) -> list[dict[str, Any]]:
    """Auto-create capability reviews for partners whose last review is > 12 months ago.

    Steps:
    1. Find all active partners.
    2. For each, check the most recent CapabilityReview.
    3. If no review exists, or the last review completed_date is > 12 months ago,
       create a new pending CapabilityReview for the current year.
    4. Create a notification to the partner (via their user account) requesting
       confirmation of accreditations.
    5. Notify MDs about the initiated reviews.
    """
    current_year = date.today().year
    twelve_months_ago = date.today() - timedelta(days=365)

    # Get all active partners
    partner_result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.status == "active")
    )
    partners = partner_result.scalars().all()

    created_reviews: list[dict[str, Any]] = []

    for partner in partners:
        # Check if a review already exists for this year
        existing_result = await db.execute(
            select(CapabilityReview).where(
                CapabilityReview.partner_id == partner.id,
                CapabilityReview.review_year == current_year,
            )
        )
        if existing_result.scalar_one_or_none():
            continue

        # Check the most recent completed review
        last_review_result = await db.execute(
            select(CapabilityReview)
            .where(
                CapabilityReview.partner_id == partner.id,
                CapabilityReview.status == "completed",
            )
            .order_by(CapabilityReview.completed_date.desc().nulls_last())
            .limit(1)
        )
        last_review = last_review_result.scalar_one_or_none()

        needs_review = (
            last_review is None
            or (
                last_review.completed_date is not None
                and last_review.completed_date < twelve_months_ago
            )
        )

        if not needs_review:
            continue

        # Create a new pending review
        review = CapabilityReview(
            partner_id=partner.id,
            review_year=current_year,
            status="pending",
            scheduled_date=date.today() + timedelta(days=30),
        )
        db.add(review)
        await db.flush()

        # Notify partner via their user account
        if partner.user_id:
            partner_user_id: uuid.UUID = partner.user_id  # type: ignore[assignment]
            await notification_service.create_notification(
                db,
                CreateNotificationRequest(
                    user_id=partner_user_id,
                    notification_type="system",
                    title=f"Annual capability review — {current_year}",
                    body=(
                        f"Your annual capability review for {current_year} has been initiated. "
                        "Please confirm your accreditations, certifications, and capabilities "
                        "are up to date."
                    ),
                    priority="high",
                    action_url=f"/capability-reviews/{review.id}",
                    action_label="Start Review",
                ),
            )

        created_reviews.append({
            "review_id": review.id,
            "partner_id": partner.id,
            "firm_name": partner.firm_name,
            "review_year": current_year,
        })

    # Notify MDs about the batch
    if created_reviews:
        md_ids = await _get_md_user_ids(db)
        for md_id in md_ids:
            await notification_service.create_notification(
                db,
                CreateNotificationRequest(
                    user_id=md_id,
                    notification_type="system",
                    title=f"Annual capability refresh initiated — {current_year}",
                    body=(
                        f"{len(created_reviews)} partner capability review(s) have been "
                        f"auto-initiated for {current_year}. Please monitor progress."
                    ),
                    priority="normal",
                    action_url="/capability-reviews",
                    action_label="View Reviews",
                ),
            )

    await db.commit()

    logger.info(
        "Annual capability refresh complete — %d reviews created",
        len(created_reviews),
    )
    return created_reviews


async def get_partner_governance_status(
    db: AsyncSession,
    partner_id: uuid.UUID,
) -> dict[str, Any]:
    """Get governance status for a partner (for the partner detail endpoint).

    Returns:
    - is_probationary: bool
    - last_review_date: date | None
    - last_review_status: str | None
    - performance_trend: list of recent overall scores
    - governance_flags: list of recent governance notifications
    """
    partner_result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id == partner_id)
    )
    partner = partner_result.scalar_one_or_none()
    if not partner:
        return {"error": "partner_not_found"}

    # Probationary check
    probation_count = settings.PARTNER_PROBATION_ENGAGEMENT_COUNT
    is_probationary = (
        partner.status == "active"
        and (partner.total_assignments or 0) < probation_count
    )

    # Last capability review
    last_review_result = await db.execute(
        select(CapabilityReview)
        .where(CapabilityReview.partner_id == partner_id)
        .order_by(CapabilityReview.review_year.desc())
        .limit(1)
    )
    last_review = last_review_result.scalar_one_or_none()

    last_review_date: date | None = None
    last_review_status: str | None = None
    if last_review:
        last_review_date = last_review.completed_date or last_review.scheduled_date
        last_review_status = last_review.status

    # Performance trend (last 10 ratings, most recent first)
    trend_result = await db.execute(
        select(PartnerRating.overall_score, PartnerRating.created_at)
        .where(PartnerRating.partner_id == partner_id)
        .order_by(PartnerRating.created_at.desc())
        .limit(10)
    )
    performance_trend = [
        {"score": row.overall_score, "date": row.created_at.isoformat()}
        for row in trend_result.all()
    ]

    # Recent governance notifications (last 12 months)
    twelve_months_ago = datetime.now(UTC) - timedelta(days=365)
    flags_result = await db.execute(
        select(Notification.title, Notification.created_at)
        .where(
            Notification.body.ilike(f"%{partner.firm_name}%"),
            Notification.title.ilike("%review%"),
            Notification.created_at >= twelve_months_ago,
        )
        .order_by(Notification.created_at.desc())
        .limit(5)
    )
    governance_flags = [
        {"title": row.title, "date": row.created_at.isoformat()}
        for row in flags_result.all()
    ]

    return {
        "is_probationary": is_probationary,
        "last_review_date": last_review_date.isoformat() if last_review_date else None,
        "last_review_status": last_review_status,
        "performance_trend": performance_trend,
        "governance_flags": governance_flags,
    }
