"""Capability review endpoints for annual partner capability refresh."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, require_internal
from app.core.exceptions import ConflictException, NotFoundException
from app.models.capability_review import CapabilityReview
from app.models.partner import PartnerProfile
from app.models.user import User
from app.schemas.capability_review import (
    CapabilityReviewListResponse,
    CapabilityReviewResponse,
    CapabilityReviewStatistics,
    CompleteCapabilityReviewRequest,
    CreateCapabilityReviewRequest,
    GenerateAnnualReviewsRequest,
    UpdateCapabilityReviewRequest,
)
from app.services.capability_review_service import capability_review_service
from app.services.crud_base import paginate

router = APIRouter()


def _enrich_review(review: CapabilityReview) -> dict[str, Any]:
    """Add computed fields to review response."""
    data = {
        "id": review.id,
        "partner_id": review.partner_id,
        "review_year": review.review_year,
        "status": review.status,
        "reviewer_id": review.reviewer_id,
        "scheduled_date": review.scheduled_date,
        "completed_date": review.completed_date,
        "capabilities_reviewed": review.capabilities_reviewed,
        "certifications_reviewed": review.certifications_reviewed,
        "qualifications_reviewed": review.qualifications_reviewed,
        "findings": review.findings,
        "notes": review.notes,
        "recommendations": review.recommendations,
        "reminder_sent_at": review.reminder_sent_at,
        "created_at": review.created_at,
        "updated_at": review.updated_at,
        "partner_name": review.partner.firm_name if review.partner else None,
        "reviewer_name": review.reviewer.full_name if review.reviewer else None,
    }
    return data


@router.get("/", response_model=CapabilityReviewListResponse)
async def list_capability_reviews(
    db: DB,
    current_user: User = Depends(require_internal),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: str | None = Query(None),
    partner_id: uuid.UUID | None = Query(None),
    year: int | None = Query(None),
) -> CapabilityReviewListResponse:
    """List all capability reviews with optional filters."""
    base = select(CapabilityReview).options(
        selectinload(CapabilityReview.partner),
        selectinload(CapabilityReview.reviewer),
    )

    if status:
        base = base.where(CapabilityReview.status == status)
    if partner_id:
        base = base.where(CapabilityReview.partner_id == partner_id)
    if year:
        base = base.where(CapabilityReview.review_year == year)

    base = base.order_by(CapabilityReview.review_year.desc(), CapabilityReview.created_at.desc())
    reviews, total = await paginate(db, base, skip=skip, limit=limit)

    return CapabilityReviewListResponse(
        reviews=[CapabilityReviewResponse(**_enrich_review(r)) for r in reviews],
        total=total,
    )


@router.get("/statistics", response_model=CapabilityReviewStatistics)
async def get_capability_review_statistics(
    db: DB,
    current_user: User = Depends(require_internal),
) -> CapabilityReviewStatistics:
    """Get capability review statistics."""
    stats = await capability_review_service.get_review_statistics(db)
    return CapabilityReviewStatistics(**stats)


@router.get("/pending", response_model=CapabilityReviewListResponse)
async def list_pending_reviews(
    db: DB,
    current_user: User = Depends(require_internal),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> CapabilityReviewListResponse:
    """List pending and scheduled reviews."""
    reviews, total = await capability_review_service.get_pending_reviews(db, skip, limit)
    return CapabilityReviewListResponse(
        reviews=[CapabilityReviewResponse(**_enrich_review(r)) for r in reviews],
        total=total,
    )


@router.get("/overdue", response_model=CapabilityReviewListResponse)
async def list_overdue_reviews(
    db: DB,
    current_user: User = Depends(require_internal),
) -> CapabilityReviewListResponse:
    """List overdue capability reviews."""
    reviews = await capability_review_service.get_overdue_reviews(db)
    return CapabilityReviewListResponse(
        reviews=[CapabilityReviewResponse(**_enrich_review(r)) for r in reviews],
        total=len(reviews),
    )


@router.post("/generate-annual", response_model=CapabilityReviewListResponse)
async def generate_annual_reviews(
    db: DB,
    data: GenerateAnnualReviewsRequest,
    current_user: User = Depends(require_internal),
) -> CapabilityReviewListResponse:
    """Generate annual capability reviews for all active partners."""
    reviews = await capability_review_service.create_annual_reviews_for_year(
        db,
        review_year=data.review_year,
        scheduled_date=data.scheduled_date,
    )

    # Reload with relationships
    if reviews:
        review_ids = [r.id for r in reviews]
        result = await db.execute(
            select(CapabilityReview)
            .options(
                selectinload(CapabilityReview.partner),
                selectinload(CapabilityReview.reviewer),
            )
            .where(CapabilityReview.id.in_(review_ids))
        )
        reviews = list(result.scalars().all())

    return CapabilityReviewListResponse(
        reviews=[CapabilityReviewResponse(**_enrich_review(r)) for r in reviews],
        total=len(reviews),
    )


@router.get("/{review_id}", response_model=CapabilityReviewResponse)
async def get_capability_review(
    review_id: uuid.UUID,
    db: DB,
    current_user: User = Depends(require_internal),
) -> CapabilityReviewResponse:
    """Get a single capability review by ID."""
    review = await capability_review_service.get_review_with_details(db, review_id)
    if not review:
        raise NotFoundException("Capability review not found")
    return CapabilityReviewResponse(**_enrich_review(review))


@router.post("/", response_model=CapabilityReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_capability_review(
    data: CreateCapabilityReviewRequest,
    db: DB,
    current_user: User = Depends(require_internal),
) -> CapabilityReviewResponse:
    """Create a new capability review."""
    # Verify partner exists
    partner_result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id == data.partner_id)
    )
    if not partner_result.scalar_one_or_none():
        raise NotFoundException("Partner not found")

    # Check for existing review for same partner/year
    existing = await db.execute(
        select(CapabilityReview).where(
            CapabilityReview.partner_id == data.partner_id,
            CapabilityReview.review_year == data.review_year,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictException("Review already exists for this partner and year")

    created_review = await capability_review_service.create(db, obj_in=data)
    review = await capability_review_service.get_review_with_details(db, created_review.id)
    return CapabilityReviewResponse(**_enrich_review(review))  # type: ignore[arg-type]


@router.put("/{review_id}", response_model=CapabilityReviewResponse)
async def update_capability_review(
    review_id: uuid.UUID,
    data: UpdateCapabilityReviewRequest,
    db: DB,
    current_user: User = Depends(require_internal),
) -> CapabilityReviewResponse:
    """Update a capability review."""
    existing = await capability_review_service.get(db, review_id)
    if not existing:
        raise NotFoundException("Capability review not found")
    updated = await capability_review_service.update(db, db_obj=existing, obj_in=data)
    review = await capability_review_service.get_review_with_details(db, updated.id)
    return CapabilityReviewResponse(**_enrich_review(review))  # type: ignore[arg-type]


@router.post("/{review_id}/complete", response_model=CapabilityReviewResponse)
async def complete_capability_review(
    review_id: uuid.UUID,
    data: CompleteCapabilityReviewRequest,
    db: DB,
    current_user: User = Depends(require_internal),
) -> CapabilityReviewResponse:
    """Mark a capability review as complete."""
    review = await capability_review_service.complete_review(
        db,
        review_id,
        findings=data.findings,
        recommendations=data.recommendations,
        notes=data.notes,
    )
    if not review:
        raise NotFoundException("Capability review not found")
    detailed = await capability_review_service.get_review_with_details(db, review.id)
    return CapabilityReviewResponse(**_enrich_review(detailed))  # type: ignore[arg-type]
