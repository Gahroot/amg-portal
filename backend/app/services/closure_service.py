"""Program closure workflow service."""

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.partner_assignment import PartnerAssignment
from app.models.partner_rating import PartnerRating
from app.models.program import Program
from app.models.program_closure import DEFAULT_CHECKLIST, ProgramClosure
from app.schemas.partner_rating import PartnerRatingCreate
from app.schemas.program_closure import ChecklistItem


async def initiate_closure(
    db: AsyncSession,
    program_id: uuid.UUID,
    user_id: uuid.UUID,
    notes: str | None = None,
) -> ProgramClosure:
    """Create a ProgramClosure record for the given program."""
    # Validate program exists and has acceptable status
    result = await db.execute(select(Program).where(Program.id == program_id))
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Program not found",
        )
    if program.status not in ("completed", "active"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=("Program must be in 'active' or 'completed' status to initiate closure"),
        )

    # Check if closure already exists
    existing = await db.execute(
        select(ProgramClosure).where(ProgramClosure.program_id == program_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Closure already initiated for this program",
        )

    closure = ProgramClosure(
        program_id=program_id,
        status="initiated",
        checklist=list(DEFAULT_CHECKLIST),
        notes=notes,
        initiated_by=user_id,
    )
    db.add(closure)
    await db.commit()
    await db.refresh(closure)
    return closure


async def get_closure_status(
    db: AsyncSession,
    program_id: uuid.UUID,
) -> ProgramClosure:
    """Return the ProgramClosure for a program."""
    result = await db.execute(select(ProgramClosure).where(ProgramClosure.program_id == program_id))
    closure = result.scalar_one_or_none()
    if not closure:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No closure record found for this program",
        )
    return closure


async def update_checklist(
    db: AsyncSession,
    program_id: uuid.UUID,
    items: list[ChecklistItem],
) -> ProgramClosure:
    """Update checklist items on the closure record."""
    closure = await get_closure_status(db, program_id)
    if closure.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update checklist on a completed closure",
        )

    closure.checklist = [item.model_dump() for item in items]
    closure.status = "in_progress"
    await db.commit()
    await db.refresh(closure)
    return closure


async def submit_partner_rating(
    db: AsyncSession,
    program_id: uuid.UUID,
    user_id: uuid.UUID,
    rating_data: PartnerRatingCreate,
) -> PartnerRating:
    """Create a PartnerRating and auto-mark checklist if all rated."""
    # Ensure closure exists
    closure = await get_closure_status(db, program_id)
    if closure.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot submit ratings on a completed closure",
        )

    # Check for duplicate
    existing = await db.execute(
        select(PartnerRating).where(
            PartnerRating.program_id == program_id,
            PartnerRating.partner_id == rating_data.partner_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Rating already exists for this partner on this program",
        )

    rating = PartnerRating(
        program_id=program_id,
        partner_id=rating_data.partner_id,
        rated_by=user_id,
        quality_score=rating_data.quality_score,
        timeliness_score=rating_data.timeliness_score,
        communication_score=rating_data.communication_score,
        overall_score=rating_data.overall_score,
        comments=rating_data.comments,
    )
    db.add(rating)
    await db.flush()

    # Check if all assigned partners have been rated
    assignments_result = await db.execute(
        select(PartnerAssignment.partner_id).where(PartnerAssignment.program_id == program_id)
    )
    assigned_partner_ids = set(assignments_result.scalars().all())

    ratings_result = await db.execute(
        select(PartnerRating.partner_id).where(PartnerRating.program_id == program_id)
    )
    rated_partner_ids = set(ratings_result.scalars().all())

    if assigned_partner_ids and assigned_partner_ids <= rated_partner_ids:
        # Auto-mark checklist item
        checklist = list(closure.checklist)
        for item in checklist:
            if item["key"] == "partner_ratings_submitted":
                item["completed"] = True
                break
        closure.checklist = checklist
        if closure.status == "initiated":
            closure.status = "in_progress"

    await db.commit()
    await db.refresh(rating)
    return rating


async def get_partner_ratings(
    db: AsyncSession,
    program_id: uuid.UUID,
) -> list[PartnerRating]:
    """List all partner ratings for a program."""
    result = await db.execute(select(PartnerRating).where(PartnerRating.program_id == program_id))
    return list(result.scalars().all())


async def complete_closure(
    db: AsyncSession,
    program_id: uuid.UUID,
    user_id: uuid.UUID,
) -> ProgramClosure:
    """Finalize the closure after validating all checklist items."""
    closure = await get_closure_status(db, program_id)
    if closure.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Closure is already completed",
        )

    # Validate all checklist items are completed
    incomplete = [item for item in closure.checklist if not item.get("completed", False)]
    if incomplete:
        labels = [str(item["label"]) for item in incomplete]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incomplete checklist items: {', '.join(labels)}",
        )

    closure.status = "completed"
    closure.completed_at = datetime.now(UTC)

    # Update the program status to closed
    result = await db.execute(select(Program).where(Program.id == program_id))
    program = result.scalar_one_or_none()
    if program:
        program.status = "closed"

    await db.commit()
    await db.refresh(closure)
    return closure
