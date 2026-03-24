"""Partner assignment management endpoints."""

import logging
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DB,
    CurrentUser,
    require_internal,
    require_rm_or_above,
)
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.partner import PartnerProfile
from app.models.partner_assignment import AssignmentHistory, PartnerAssignment
from app.models.partner_blocker import PartnerBlocker
from app.models.program import Program
from app.schemas.partner_assignment import (
    AssignmentCreate,
    AssignmentHistoryEntry,
    AssignmentListResponse,
    AssignmentResponse,
    AssignmentUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _is_due_date_blocked(blocker: PartnerBlocker, d: date) -> bool:
    """Return True if the blocker covers the given date."""
    start: date = blocker.start_date  # type: ignore[assignment]
    end: date = blocker.end_date  # type: ignore[assignment]
    if not (start <= d <= end):
        return False
    if not blocker.is_recurring:
        return True
    if blocker.recurrence_type == "weekly":
        days: list[int] = blocker.recurrence_days or []  # type: ignore[assignment]
        return d.isoweekday() in days
    return True


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
        "offer_expires_at": assignment.offer_expires_at,
        "accepted_at": assignment.accepted_at,
        "completed_at": assignment.completed_at,
        "declined_at": assignment.declined_at,
        "decline_reason": assignment.decline_reason,
        "created_at": assignment.created_at,
        "updated_at": assignment.updated_at,
        "brief_pdf_path": assignment.brief_pdf_path,
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
        raise NotFoundException("Partner not found")

    # Verify program exists
    program_result = await db.execute(select(Program).where(Program.id == data.program_id))
    if not program_result.scalar_one_or_none():
        raise NotFoundException("Program not found")

    # Check capacity blockers if a due_date is provided
    if data.due_date:
        from sqlalchemy import and_ as _and

        blocker_result = await db.execute(
            select(PartnerBlocker).where(
                _and(
                    PartnerBlocker.partner_id == data.partner_id,
                    PartnerBlocker.start_date <= data.due_date,
                    PartnerBlocker.end_date >= data.due_date,
                )
            )
        )
        blocking = [
            b for b in blocker_result.scalars().all()
            if _is_due_date_blocked(b, data.due_date)
        ]
        if blocking:
            first = blocking[0]
            reason_hint = f": {first.reason}" if first.reason else ""
            raise BadRequestException(
                f"Partner has declared unavailability on {data.due_date} "
                f"({first.blocker_type}{reason_hint}). "
                "Remove the blocker or choose a different due date."
            )

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
    search: str | None = None,
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
    if search:
        filters.append(PartnerAssignment.title.ilike(f"%{search}%"))

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
        raise NotFoundException("Assignment not found")
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
        raise NotFoundException("Assignment not found")

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
    offer_hours: int = Query(48, ge=1, le=720, description="Hours partner has to accept the offer"),
):
    result = await db.execute(
        select(PartnerAssignment)
        .options(selectinload(PartnerAssignment.partner), selectinload(PartnerAssignment.program))
        .where(PartnerAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise NotFoundException("Assignment not found")
    if assignment.status != "draft":
        raise BadRequestException("Only draft assignments can be dispatched")

    now = datetime.now(UTC)
    assignment.status = "dispatched"
    assignment.offer_expires_at = now + timedelta(hours=offer_hours)

    db.add(
        AssignmentHistory(
            assignment_id=assignment.id,
            actor_id=current_user.id,
            event="dispatched",
        )
    )
    await db.commit()
    await db.refresh(assignment)

    # Re-fetch with relationships needed for brief generation
    result = await db.execute(
        select(PartnerAssignment)
        .options(
            selectinload(PartnerAssignment.partner),
            selectinload(PartnerAssignment.program),
        )
        .where(PartnerAssignment.id == assignment.id)
    )
    assignment = result.scalar_one()

    try:
        await _generate_and_store_brief(db, assignment)
    except Exception:
        logger.exception("Failed to generate brief PDF for assignment %s", assignment.id)

    try:
        from app.services.auto_dispatch_service import on_assignment_dispatched

        await on_assignment_dispatched(db, assignment)
    except Exception:
        logger.exception("Failed to dispatch partner_dispatch for %s", assignment.id)

    # Re-fetch after potential brief_pdf_path update
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


async def _generate_and_store_brief(db: DB, assignment: PartnerAssignment) -> None:
    """Render the brief template to PDF and persist the MinIO path on the assignment."""
    from fastapi.concurrency import run_in_threadpool

    from app.services.pdf_service import pdf_service

    dispatched_at = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")

    data = {
        "assignment_title": str(assignment.title),
        "program_title": assignment.program.title if assignment.program else "N/A",
        "partner_firm_name": assignment.partner.firm_name if assignment.partner else "N/A",
        "partner_contact_name": assignment.partner.contact_name if assignment.partner else "N/A",
        "brief": str(assignment.brief or ""),
        "sla_terms": str(assignment.sla_terms) if assignment.sla_terms else None,
        "due_date": str(assignment.due_date) if assignment.due_date else None,
        "dispatched_at": dispatched_at,
        "generated_at": dispatched_at,
    }

    pdf_bytes: bytes = await run_in_threadpool(pdf_service.generate_brief_pdf, data)
    object_path: str = await pdf_service.store_report_pdf(
        pdf_bytes,
        report_type="briefs",
        entity_id=str(assignment.id),
    )

    assignment.brief_pdf_path = object_path
    await db.commit()


@router.get(
    "/{assignment_id}/history",
    response_model=list[AssignmentHistoryEntry],
    dependencies=[Depends(require_internal)],
)
async def get_assignment_history_internal(
    assignment_id: UUID,
    db: DB,
    current_user: CurrentUser,
):
    """Return the full accept/decline history for an assignment (internal staff only)."""
    owner_result = await db.execute(
        select(PartnerAssignment.id).where(PartnerAssignment.id == assignment_id)
    )
    if not owner_result.one_or_none():
        raise NotFoundException("Assignment not found")

    history_result = await db.execute(
        select(AssignmentHistory)
        .where(AssignmentHistory.assignment_id == assignment_id)
        .order_by(AssignmentHistory.created_at)
    )
    return history_result.scalars().all()
