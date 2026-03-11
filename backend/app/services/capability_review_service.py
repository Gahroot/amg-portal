"""Service for capability review operations."""

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.capability_review import CapabilityReview
from app.models.partner import PartnerProfile
from app.schemas.capability_review import (
    CreateCapabilityReviewRequest,
    UpdateCapabilityReviewRequest,
)
from app.services.crud_base import CRUDBase


class CapabilityReviewService(
    CRUDBase[CapabilityReview, CreateCapabilityReviewRequest, UpdateCapabilityReviewRequest]
):
    """Service for capability review operations."""

    async def get_reviews_for_partner(
        self,
        db: AsyncSession,
        partner_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[CapabilityReview], int]:
        """Get all capability reviews for a partner."""
        base = select(CapabilityReview).where(CapabilityReview.partner_id == partner_id)
        count_query = select(func.count()).select_from(base.subquery())
        total = (await db.execute(count_query)).scalar_one()

        result = await db.execute(
            base.options(
                selectinload(CapabilityReview.reviewer),
                selectinload(CapabilityReview.partner),
            )
            .order_by(CapabilityReview.review_year.desc())
            .offset(skip)
            .limit(limit)
        )
        reviews = list(result.scalars().all())
        return reviews, total

    async def get_pending_reviews(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[CapabilityReview], int]:
        """Get all pending or scheduled reviews."""
        base = select(CapabilityReview).where(
            CapabilityReview.status.in_(["pending", "scheduled", "in_progress"])
        )
        count_query = select(func.count()).select_from(base.subquery())
        total = (await db.execute(count_query)).scalar_one()

        result = await db.execute(
            base.options(
                selectinload(CapabilityReview.reviewer),
                selectinload(CapabilityReview.partner),
            )
            .order_by(CapabilityReview.scheduled_date.asc().nulls_last())
            .offset(skip)
            .limit(limit)
        )
        reviews = list(result.scalars().all())
        return reviews, total

    async def get_overdue_reviews(
        self,
        db: AsyncSession,
    ) -> list[CapabilityReview]:
        """Get all overdue capability reviews."""
        today = date.today()
        result = await db.execute(
            select(CapabilityReview)
            .options(
                selectinload(CapabilityReview.reviewer),
                selectinload(CapabilityReview.partner),
            )
            .where(
                CapabilityReview.status.in_(["pending", "scheduled", "in_progress"]),
                CapabilityReview.scheduled_date < today,
            )
            .order_by(CapabilityReview.scheduled_date.asc())
        )
        return list(result.scalars().all())

    async def get_reviews_due_soon(
        self,
        db: AsyncSession,
        days: int = 30,
    ) -> list[CapabilityReview]:
        """Get reviews due within the specified number of days."""
        today = date.today()
        due_date = today + timedelta(days=days)
        result = await db.execute(
            select(CapabilityReview)
            .options(
                selectinload(CapabilityReview.reviewer),
                selectinload(CapabilityReview.partner),
            )
            .where(
                CapabilityReview.status.in_(["pending", "scheduled"]),
                CapabilityReview.scheduled_date >= today,
                CapabilityReview.scheduled_date <= due_date,
            )
            .order_by(CapabilityReview.scheduled_date.asc())
        )
        return list(result.scalars().all())

    async def create_annual_reviews_for_year(
        self,
        db: AsyncSession,
        review_year: int,
        scheduled_date: date | None = None,
    ) -> list[CapabilityReview]:
        """Create capability reviews for all active partners for a given year."""
        # Get all active partners
        result = await db.execute(
            select(PartnerProfile).where(PartnerProfile.status == "active")
        )
        partners = result.scalars().all()

        created_reviews = []
        for partner in partners:
            # Check if review already exists
            existing = await db.execute(
                select(CapabilityReview).where(
                    CapabilityReview.partner_id == partner.id,
                    CapabilityReview.review_year == review_year,
                )
            )
            if existing.scalar_one_or_none():
                continue

            review = CapabilityReview(
                partner_id=partner.id,
                review_year=review_year,
                status="pending",
                scheduled_date=scheduled_date,
            )
            db.add(review)
            created_reviews.append(review)

        await db.commit()
        for review in created_reviews:
            await db.refresh(review)

        return created_reviews

    async def complete_review(
        self,
        db: AsyncSession,
        review_id: uuid.UUID,
        findings: list[dict[str, Any]] | None = None,
        recommendations: str | None = None,
        notes: str | None = None,
    ) -> CapabilityReview | None:
        """Mark a capability review as complete."""
        result = await db.execute(
            select(CapabilityReview).where(CapabilityReview.id == review_id)
        )
        review = result.scalar_one_or_none()
        if not review:
            return None

        review.status = "completed"
        review.completed_date = date.today()
        if findings:
            review.findings = findings
        if recommendations:
            review.recommendations = recommendations
        if notes:
            review.notes = notes

        await db.commit()
        await db.refresh(review)
        return review

    async def update_review_status(
        self,
        db: AsyncSession,
        review_id: uuid.UUID,
        status: str,
    ) -> CapabilityReview | None:
        """Update the status of a capability review."""
        result = await db.execute(
            select(CapabilityReview).where(CapabilityReview.id == review_id)
        )
        review = result.scalar_one_or_none()
        if not review:
            return None

        review.status = status
        if status == "in_progress" and not review.started_at:
            # Track when review started (we can add this field later if needed)
            pass

        await db.commit()
        await db.refresh(review)
        return review

    async def mark_reminder_sent(
        self,
        db: AsyncSession,
        review_id: uuid.UUID,
    ) -> None:
        """Mark that a reminder was sent for this review."""
        result = await db.execute(
            select(CapabilityReview).where(CapabilityReview.id == review_id)
        )
        review = result.scalar_one_or_none()
        if review:
            review.reminder_sent_at = datetime.now(UTC)
            await db.commit()

    async def get_review_statistics(
        self,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Get statistics about capability reviews."""
        # Total counts by status
        status_counts = {}
        for status in ["pending", "scheduled", "in_progress", "completed", "overdue", "waived"]:
            count_result = await db.execute(
                select(func.count()).where(CapabilityReview.status == status)
            )
            status_counts[status] = count_result.scalar_one()

        total_result = await db.execute(select(func.count()).select_from(CapabilityReview))
        total = total_result.scalar_one()

        # Count by year
        year_result = await db.execute(
            select(CapabilityReview.review_year, func.count().label("count"))
            .group_by(CapabilityReview.review_year)
            .order_by(CapabilityReview.review_year.desc())
        )
        by_year = {row.review_year: row.count for row in year_result.all()}

        return {
            "total": total,
            **status_counts,
            "by_year": by_year,
        }

    async def get_review_with_details(
        self,
        db: AsyncSession,
        review_id: uuid.UUID,
    ) -> CapabilityReview | None:
        """Get a capability review with partner and reviewer details."""
        result = await db.execute(
            select(CapabilityReview)
            .options(
                selectinload(CapabilityReview.reviewer),
                selectinload(CapabilityReview.partner),
            )
            .where(CapabilityReview.id == review_id)
        )
        return result.scalar_one_or_none()


capability_review_service = CapabilityReviewService(CapabilityReview)
