"""Deliverable management endpoints."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DB,
    CurrentPartner,
    CurrentUser,
    require_coordinator_or_above,
    require_internal,
)
from app.models.deliverable import Deliverable
from app.models.partner_assignment import PartnerAssignment
from app.schemas.deliverable import (
    DeliverableCreate,
    DeliverableListResponse,
    DeliverableResponse,
    DeliverableReview,
    DeliverableUpdate,
)
from app.services.storage import storage_service

router = APIRouter()


def build_deliverable_response(deliverable: Deliverable) -> dict:
    data = {
        "id": deliverable.id,
        "assignment_id": deliverable.assignment_id,
        "title": deliverable.title,
        "deliverable_type": deliverable.deliverable_type,
        "description": deliverable.description,
        "due_date": deliverable.due_date,
        "file_path": deliverable.file_path,
        "file_name": deliverable.file_name,
        "file_size": deliverable.file_size,
        "submitted_at": deliverable.submitted_at,
        "submitted_by": deliverable.submitted_by,
        "status": deliverable.status,
        "review_comments": deliverable.review_comments,
        "reviewed_by": deliverable.reviewed_by,
        "reviewed_at": deliverable.reviewed_at,
        "client_visible": deliverable.client_visible,
        "created_at": deliverable.created_at,
        "updated_at": deliverable.updated_at,
        "download_url": None,
    }
    if deliverable.file_path:
        import contextlib

        with contextlib.suppress(Exception):
            data["download_url"] = storage_service.get_presigned_url(
                deliverable.file_path,
            )
    return data


@router.post("/", response_model=DeliverableResponse, status_code=201)
async def create_deliverable(
    data: DeliverableCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_coordinator_or_above),
):
    # Verify assignment exists
    assignment_result = await db.execute(
        select(PartnerAssignment).where(PartnerAssignment.id == data.assignment_id)
    )
    if not assignment_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Assignment not found")

    deliverable = Deliverable(
        assignment_id=data.assignment_id,
        title=data.title,
        deliverable_type=data.deliverable_type,
        description=data.description,
        due_date=data.due_date,
        status="pending",
    )
    db.add(deliverable)
    await db.commit()
    await db.refresh(deliverable)
    return build_deliverable_response(deliverable)


@router.get("/", response_model=DeliverableListResponse)
async def list_deliverables(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    assignment_id: UUID | None = None,
    status: str | None = None,
):
    query = select(Deliverable)
    count_query = select(func.count()).select_from(Deliverable)

    filters = []
    if assignment_id:
        filters.append(Deliverable.assignment_id == assignment_id)
    if status:
        filters.append(Deliverable.status == status)

    for f in filters:
        query = query.where(f)
        count_query = count_query.where(f)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.offset(skip).limit(limit).order_by(Deliverable.created_at.desc())
    result = await db.execute(query)
    deliverables = result.scalars().all()

    return DeliverableListResponse(
        deliverables=[build_deliverable_response(d) for d in deliverables],
        total=total,
    )


@router.get("/{deliverable_id}", response_model=DeliverableResponse)
async def get_deliverable(
    deliverable_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
):
    result = await db.execute(select(Deliverable).where(Deliverable.id == deliverable_id))
    deliverable = result.scalar_one_or_none()
    if not deliverable:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    return build_deliverable_response(deliverable)


@router.patch("/{deliverable_id}", response_model=DeliverableResponse)
async def update_deliverable(
    deliverable_id: UUID,
    data: DeliverableUpdate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_coordinator_or_above),
):
    result = await db.execute(select(Deliverable).where(Deliverable.id == deliverable_id))
    deliverable = result.scalar_one_or_none()
    if not deliverable:
        raise HTTPException(status_code=404, detail="Deliverable not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(deliverable, field, value)

    await db.commit()
    await db.refresh(deliverable)
    return build_deliverable_response(deliverable)


@router.post("/{deliverable_id}/submit", response_model=DeliverableResponse)
async def submit_deliverable(
    deliverable_id: UUID,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    file: UploadFile = File(...),
):
    result = await db.execute(
        select(Deliverable)
        .options(selectinload(Deliverable.assignment))
        .where(Deliverable.id == deliverable_id)
    )
    deliverable = result.scalar_one_or_none()
    if not deliverable:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    if deliverable.assignment.partner_id != partner.id:
        raise HTTPException(status_code=403, detail="Not your deliverable")
    if deliverable.status not in ("pending", "returned"):
        raise HTTPException(
            status_code=400,
            detail="Deliverable cannot be submitted in current status",
        )

    object_path, file_size = await storage_service.upload_file(
        file, f"deliverables/{deliverable.assignment_id}"
    )

    deliverable.file_path = object_path
    deliverable.file_name = file.filename
    deliverable.file_size = file_size
    deliverable.submitted_at = datetime.now(UTC)
    deliverable.submitted_by = current_user.id
    deliverable.status = "submitted"

    await db.commit()
    await db.refresh(deliverable)
    return build_deliverable_response(deliverable)


@router.post("/{deliverable_id}/review", response_model=DeliverableResponse)
async def review_deliverable(
    deliverable_id: UUID,
    data: DeliverableReview,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_coordinator_or_above),
):
    if data.status not in ("approved", "returned", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid review status")

    result = await db.execute(select(Deliverable).where(Deliverable.id == deliverable_id))
    deliverable = result.scalar_one_or_none()
    if not deliverable:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    if deliverable.status not in ("submitted", "under_review"):
        raise HTTPException(status_code=400, detail="Deliverable is not ready for review")

    deliverable.status = data.status
    deliverable.review_comments = data.review_comments
    deliverable.reviewed_by = current_user.id
    deliverable.reviewed_at = datetime.now(UTC)

    if data.status == "approved":
        deliverable.client_visible = True

    await db.commit()
    await db.refresh(deliverable)
    return build_deliverable_response(deliverable)


@router.get("/{deliverable_id}/download")
async def download_deliverable(
    deliverable_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
):
    result = await db.execute(select(Deliverable).where(Deliverable.id == deliverable_id))
    deliverable = result.scalar_one_or_none()
    if not deliverable:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    if not deliverable.file_path:
        raise HTTPException(status_code=404, detail="No file uploaded")

    url = storage_service.get_presigned_url(deliverable.file_path)
    return {"download_url": url}
