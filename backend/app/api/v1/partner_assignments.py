"""Partner assignment management endpoints."""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DB,
    CurrentPartner,
    CurrentUser,
    require_coordinator_or_above,
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
from app.services.audit_service import log_action, model_to_dict

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
    request: Request,
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

    initial_status = data.status if data.status in ("draft", "dispatched") else "draft"

    assignment = PartnerAssignment(
        partner_id=data.partner_id,
        program_id=data.program_id,
        assigned_by=current_user.id,
        title=data.title,
        brief=data.brief,
        sla_terms=data.sla_terms,
        due_date=data.due_date,
        status=initial_status,
    )
    db.add(assignment)
    await db.flush()
    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="create",
        entity_type="partner_assignment",
        entity_id=str(assignment.id),
        after_state=model_to_dict(assignment),
        request=request,
    )
    await db.commit()

    # Auto-dispatch brief if created directly in dispatched status
    if initial_status == "dispatched":
        try:
            from app.services.auto_dispatch_service import on_assignment_dispatched

            await on_assignment_dispatched(db, assignment)
        except Exception:
            logger.exception(
                "Failed to dispatch partner_dispatch on create for %s",
                assignment.id,
            )

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
    _: None = Depends(require_coordinator_or_above),
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
    _: None = Depends(require_coordinator_or_above),
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
    request: Request,
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

    before = model_to_dict(assignment)
    previous_status = assignment.status
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(assignment, field, value)

    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="partner_assignment",
        entity_id=str(assignment_id),
        before_state=before,
        after_state=model_to_dict(assignment),
        request=request,
    )
    await db.commit()
    await db.refresh(assignment)

    # Auto-dispatch brief when status transitions to dispatched
    if previous_status != "dispatched" and assignment.status == "dispatched":
        try:
            from app.services.auto_dispatch_service import on_assignment_dispatched

            await on_assignment_dispatched(db, assignment)
        except Exception:
            logger.exception(
                "Failed to dispatch partner_dispatch on update for %s",
                assignment.id,
            )

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
    request: Request,
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

    before = model_to_dict(assignment)
    assignment.status = "dispatched"
    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="partner_assignment",
        entity_id=str(assignment_id),
        before_state=before,
        after_state=model_to_dict(assignment),
        request=request,
    )
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
    request: Request,
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

    before = model_to_dict(assignment)
    assignment.status = "accepted"
    assignment.accepted_at = datetime.now(UTC)
    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="partner_assignment",
        entity_id=str(assignment_id),
        before_state=before,
        after_state=model_to_dict(assignment),
        request=request,
    )
    await db.commit()
    await db.refresh(assignment)

    result = await db.execute(
        select(PartnerAssignment)
        .options(selectinload(PartnerAssignment.partner), selectinload(PartnerAssignment.program))
        .where(PartnerAssignment.id == assignment.id)
    )
    assignment = result.scalar_one()
    return build_assignment_response(assignment)
