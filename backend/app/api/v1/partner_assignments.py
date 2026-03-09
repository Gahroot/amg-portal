"""Partner assignment management endpoints."""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DB,
    CurrentPartner,
    CurrentUser,
    require_internal,
    require_rm_or_above,
)
from app.models.partner import PartnerProfile
from app.models.partner_assignment import PartnerAssignment
from app.models.program import Program
from app.schemas.partner_assignment import (
    AssignmentCreate,
    AssignmentListResponse,
    AssignmentResponse,
    AssignmentUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def build_assignment_response(assignment: PartnerAssignment) -> dict[str, Any]:
    return {
        "id": assignment.id,
        "partner_id": assignment.partner_id,
        "program_id": assignment.program_id,
        "assigned_by": assignment.assigned_by,
        "title": assignment.title,
        "brief": assignment.brief,
        "sla_terms": assignment.sla_terms,
        "status": assignment.status,
        "due_date": assignment.due_date,
        "accepted_at": assignment.accepted_at,
        "completed_at": assignment.completed_at,
        "created_at": assignment.created_at,
        "updated_at": assignment.updated_at,
        "partner_firm_name": assignment.partner.firm_name if assignment.partner else None,
        "program_title": assignment.program.title if assignment.program else None,
    }


@router.post("/", response_model=AssignmentResponse, status_code=201)
async def create_assignment(
    data: AssignmentCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
):
    # Verify partner exists
    partner_result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id == data.partner_id)
    )
    if not partner_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Partner not found")

    # Verify program exists
    program_result = await db.execute(select(Program).where(Program.id == data.program_id))
    if not program_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Program not found")

    assignment = PartnerAssignment(
        partner_id=data.partner_id,
        program_id=data.program_id,
        assigned_by=current_user.id,
        title=data.title,
        brief=data.brief,
        sla_terms=data.sla_terms,
        due_date=data.due_date,
        status="draft",
    )
    db.add(assignment)
    await db.commit()

    result = await db.execute(
        select(PartnerAssignment)
        .options(selectinload(PartnerAssignment.partner), selectinload(PartnerAssignment.program))
        .where(PartnerAssignment.id == assignment.id)
    )
    assignment = result.scalar_one()
    return build_assignment_response(assignment)


@router.get("/", response_model=AssignmentListResponse)
async def list_assignments(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    partner_id: UUID | None = None,
    program_id: UUID | None = None,
    status: str | None = None,
):
    query = select(PartnerAssignment).options(
        selectinload(PartnerAssignment.partner),
        selectinload(PartnerAssignment.program),
    )
    count_query = select(func.count()).select_from(PartnerAssignment)

    filters = []
    if partner_id:
        filters.append(PartnerAssignment.partner_id == partner_id)
    if program_id:
        filters.append(PartnerAssignment.program_id == program_id)
    if status:
        filters.append(PartnerAssignment.status == status)

    for f in filters:
        query = query.where(f)
        count_query = count_query.where(f)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.offset(skip).limit(limit).order_by(PartnerAssignment.created_at.desc())
    result = await db.execute(query)
    assignments = result.scalars().all()

    return AssignmentListResponse(
        assignments=[build_assignment_response(a) for a in assignments],
        total=total,
    )


@router.get("/{assignment_id}", response_model=AssignmentResponse)
async def get_assignment(
    assignment_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
):
    result = await db.execute(
        select(PartnerAssignment)
        .options(selectinload(PartnerAssignment.partner), selectinload(PartnerAssignment.program))
        .where(PartnerAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return build_assignment_response(assignment)


@router.patch("/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: UUID,
    data: AssignmentUpdate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
):
    result = await db.execute(
        select(PartnerAssignment)
        .options(selectinload(PartnerAssignment.partner), selectinload(PartnerAssignment.program))
        .where(PartnerAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(assignment, field, value)

    await db.commit()
    await db.refresh(assignment)

    # Re-fetch with relationships
    result = await db.execute(
        select(PartnerAssignment)
        .options(selectinload(PartnerAssignment.partner), selectinload(PartnerAssignment.program))
        .where(PartnerAssignment.id == assignment.id)
    )
    assignment = result.scalar_one()
    return build_assignment_response(assignment)


@router.post("/{assignment_id}/dispatch", response_model=AssignmentResponse)
async def dispatch_assignment(
    assignment_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
):
    result = await db.execute(
        select(PartnerAssignment)
        .options(selectinload(PartnerAssignment.partner), selectinload(PartnerAssignment.program))
        .where(PartnerAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft assignments can be dispatched")

    assignment.status = "dispatched"
    await db.commit()
    await db.refresh(assignment)

    try:
        from app.services.auto_dispatch_service import (
            on_assignment_dispatched,
        )

        await on_assignment_dispatched(db, assignment)
    except Exception:
        logger.exception(
            "Failed to dispatch partner_dispatch for %s",
            assignment.id,
        )

    result = await db.execute(
        select(PartnerAssignment)
        .options(
            selectinload(PartnerAssignment.partner),
            selectinload(PartnerAssignment.program),
        )
        .where(PartnerAssignment.id == assignment.id)
    )
    assignment = result.scalar_one()
    return build_assignment_response(assignment)


@router.post("/{assignment_id}/accept", response_model=AssignmentResponse)
async def accept_assignment(
    assignment_id: UUID,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
):
    result = await db.execute(
        select(PartnerAssignment)
        .options(selectinload(PartnerAssignment.partner), selectinload(PartnerAssignment.program))
        .where(PartnerAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.partner_id != partner.id:
        raise HTTPException(status_code=403, detail="Not your assignment")
    if assignment.status != "dispatched":
        raise HTTPException(status_code=400, detail="Only dispatched assignments can be accepted")

    assignment.status = "accepted"
    assignment.accepted_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(assignment)

    result = await db.execute(
        select(PartnerAssignment)
        .options(selectinload(PartnerAssignment.partner), selectinload(PartnerAssignment.program))
        .where(PartnerAssignment.id == assignment.id)
    )
    assignment = result.scalar_one()
    return build_assignment_response(assignment)
