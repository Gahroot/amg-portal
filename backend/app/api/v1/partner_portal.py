"""Partner portal endpoints (partner-facing views)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentPartner, CurrentUser
from app.models.deliverable import Deliverable
from app.models.partner_assignment import PartnerAssignment
from app.schemas.deliverable import DeliverableListResponse
from app.schemas.partner import PartnerProfileResponse
from app.schemas.partner_assignment import AssignmentListResponse, AssignmentResponse
from app.services.storage import storage_service

router = APIRouter()


@router.get("/profile", response_model=PartnerProfileResponse)
async def get_my_profile(
    current_user: CurrentUser,
    partner: CurrentPartner = Depends(),
):
    return partner


@router.get("/assignments", response_model=AssignmentListResponse)
async def get_my_assignments(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner = Depends(),
):
    result = await db.execute(
        select(PartnerAssignment)
        .options(selectinload(PartnerAssignment.partner), selectinload(PartnerAssignment.program))
        .where(PartnerAssignment.partner_id == partner.id)
        .order_by(PartnerAssignment.created_at.desc())
    )
    assignments = result.scalars().all()

    def build_response(a):
        return {
            "id": a.id,
            "partner_id": a.partner_id,
            "program_id": a.program_id,
            "assigned_by": a.assigned_by,
            "title": a.title,
            "brief": a.brief,
            "sla_terms": a.sla_terms,
            "status": a.status,
            "due_date": a.due_date,
            "accepted_at": a.accepted_at,
            "completed_at": a.completed_at,
            "created_at": a.created_at,
            "updated_at": a.updated_at,
            "partner_firm_name": a.partner.firm_name if a.partner else None,
            "program_title": a.program.title if a.program else None,
        }

    return AssignmentListResponse(
        assignments=[build_response(a) for a in assignments],
        total=len(assignments),
    )


@router.get("/assignments/{assignment_id}", response_model=AssignmentResponse)
async def get_my_assignment(
    assignment_id: UUID,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner = Depends(),
):
    result = await db.execute(
        select(PartnerAssignment)
        .options(
            selectinload(PartnerAssignment.partner),
            selectinload(PartnerAssignment.program),
            selectinload(PartnerAssignment.deliverables),
        )
        .where(PartnerAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.partner_id != partner.id:
        raise HTTPException(status_code=403, detail="Not your assignment")

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


@router.get("/deliverables", response_model=DeliverableListResponse)
async def get_my_deliverables(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner = Depends(),
):
    # Get all assignments for this partner, then all deliverables
    assignments_result = await db.execute(
        select(PartnerAssignment.id).where(PartnerAssignment.partner_id == partner.id)
    )
    assignment_ids = [row[0] for row in assignments_result.all()]

    if not assignment_ids:
        return DeliverableListResponse(deliverables=[], total=0)

    result = await db.execute(
        select(Deliverable)
        .where(Deliverable.assignment_id.in_(assignment_ids))
        .order_by(Deliverable.created_at.desc())
    )
    deliverables = result.scalars().all()

    def build_response(d):
        data = {
            "id": d.id,
            "assignment_id": d.assignment_id,
            "title": d.title,
            "deliverable_type": d.deliverable_type,
            "description": d.description,
            "due_date": d.due_date,
            "file_path": d.file_path,
            "file_name": d.file_name,
            "file_size": d.file_size,
            "submitted_at": d.submitted_at,
            "submitted_by": d.submitted_by,
            "status": d.status,
            "review_comments": d.review_comments,
            "reviewed_by": d.reviewed_by,
            "reviewed_at": d.reviewed_at,
            "client_visible": d.client_visible,
            "created_at": d.created_at,
            "updated_at": d.updated_at,
            "download_url": None,
        }
        if d.file_path:
            import contextlib

            with contextlib.suppress(Exception):
                data["download_url"] = storage_service.get_presigned_url(d.file_path)
        return data

    return DeliverableListResponse(
        deliverables=[build_response(d) for d in deliverables],
        total=len(deliverables),
    )
