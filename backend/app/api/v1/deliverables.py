"""Deliverable management endpoints."""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DB,
    CurrentPartner,
    CurrentUser,
    RLSContext,
    require_coordinator_or_above,
    require_internal,
)
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.deliverable import Deliverable
from app.models.document import Document
from app.models.partner_assignment import PartnerAssignment
from app.schemas.deliverable import (
    DeliverableAttachDocument,
    DeliverableCreate,
    DeliverableListResponse,
    DeliverableResponse,
    DeliverableReview,
    DeliverableUpdate,
)
from app.services.storage import storage_service

logger = logging.getLogger(__name__)

router = APIRouter()


def build_deliverable_response(deliverable: Deliverable) -> dict[str, Any]:
    data: dict[str, Any] = {
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
                str(deliverable.file_path),
            )
    return data


@router.post("/", response_model=DeliverableResponse, status_code=201)
async def create_deliverable(
    data: DeliverableCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
) -> dict[str, Any]:
    # Verify assignment exists
    assignment_result = await db.execute(
        select(PartnerAssignment).where(PartnerAssignment.id == data.assignment_id)
    )
    if not assignment_result.scalar_one_or_none():
        raise NotFoundException("Assignment not found")

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
    _rls: RLSContext,
    _: None = Depends(require_internal),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    assignment_id: UUID | None = None,
    status: str | None = None,
    search: str | None = None,
) -> DeliverableListResponse:
    query = select(Deliverable)
    count_query = select(func.count()).select_from(Deliverable)

    filters = []
    if assignment_id:
        filters.append(Deliverable.assignment_id == assignment_id)
    if status:
        filters.append(Deliverable.status == status)
    if search:
        filters.append(Deliverable.title.ilike(f"%{search}%"))

    for f in filters:
        query = query.where(f)
        count_query = count_query.where(f)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.offset(skip).limit(limit).order_by(Deliverable.created_at.desc())
    result = await db.execute(query)
    deliverables = result.scalars().all()

    return DeliverableListResponse(
        deliverables=[build_deliverable_response(d) for d in deliverables],  # type: ignore[misc]
        total=total,
    )


@router.get("/{deliverable_id}", response_model=DeliverableResponse)
async def get_deliverable(
    deliverable_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> dict[str, Any]:
    result = await db.execute(select(Deliverable).where(Deliverable.id == deliverable_id))
    deliverable = result.scalar_one_or_none()
    if not deliverable:
        raise NotFoundException("Deliverable not found")
    return build_deliverable_response(deliverable)


@router.patch("/{deliverable_id}", response_model=DeliverableResponse)
async def update_deliverable(
    deliverable_id: UUID,
    data: DeliverableUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
) -> dict[str, Any]:
    result = await db.execute(select(Deliverable).where(Deliverable.id == deliverable_id))
    deliverable = result.scalar_one_or_none()
    if not deliverable:
        raise NotFoundException("Deliverable not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(deliverable, field, value)

    await db.commit()
    await db.refresh(deliverable)
    return build_deliverable_response(deliverable)


@router.post("/{deliverable_id}/upload", response_model=DeliverableResponse, status_code=200)
async def upload_deliverable_file(
    deliverable_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """Upload a file directly to an existing deliverable (internal staff only)."""
    result = await db.execute(select(Deliverable).where(Deliverable.id == deliverable_id))
    deliverable = result.scalar_one_or_none()
    if not deliverable:
        raise NotFoundException("Deliverable not found")

    await storage_service.validate_file(file)
    object_path, file_size = await storage_service.upload_file(
        file, f"deliverables/{deliverable.assignment_id}"
    )

    deliverable.file_path = object_path
    deliverable.file_name = file.filename
    deliverable.file_size = file_size
    deliverable.submitted_at = datetime.now(UTC)
    deliverable.submitted_by = current_user.id
    deliverable.status = "submitted"  # type: ignore[assignment]

    await db.commit()
    await db.refresh(deliverable)
    return build_deliverable_response(deliverable)


@router.post(
    "/{deliverable_id}/attach-document",
    response_model=DeliverableResponse,
    status_code=200,
)
async def attach_document_to_deliverable(
    deliverable_id: UUID,
    data: DeliverableAttachDocument,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
) -> dict[str, Any]:
    """Link an existing document to a deliverable (internal staff only)."""
    result = await db.execute(select(Deliverable).where(Deliverable.id == deliverable_id))
    deliverable = result.scalar_one_or_none()
    if not deliverable:
        raise NotFoundException("Deliverable not found")

    doc_result = await db.execute(select(Document).where(Document.id == data.document_id))
    document = doc_result.scalar_one_or_none()
    if not document:
        raise NotFoundException("Document not found")

    deliverable.file_path = document.file_path
    deliverable.file_name = document.file_name
    deliverable.file_size = document.file_size
    deliverable.submitted_at = datetime.now(UTC)
    deliverable.submitted_by = current_user.id
    deliverable.status = "submitted"  # type: ignore[assignment]

    await db.commit()
    await db.refresh(deliverable)
    return build_deliverable_response(deliverable)


@router.post("/{deliverable_id}/submit", response_model=DeliverableResponse)
async def submit_deliverable(
    deliverable_id: UUID,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
    file: UploadFile = File(...),
) -> dict[str, Any]:
    result = await db.execute(
        select(Deliverable)
        .options(selectinload(Deliverable.assignment))
        .where(Deliverable.id == deliverable_id)
    )
    deliverable = result.scalar_one_or_none()
    if not deliverable:
        raise NotFoundException("Deliverable not found")
    if deliverable.assignment.partner_id != partner.id:
        raise ForbiddenException("Not your deliverable")
    if deliverable.status not in ("pending", "returned"):
        raise BadRequestException("Deliverable cannot be submitted in current status")

    await storage_service.validate_file(file)
    object_path, file_size = await storage_service.upload_file(
        file, f"deliverables/{deliverable.assignment_id}"
    )

    deliverable.file_path = object_path
    deliverable.file_name = file.filename
    deliverable.file_size = file_size
    deliverable.submitted_at = datetime.now(UTC)
    deliverable.submitted_by = current_user.id
    deliverable.status = "submitted"  # type: ignore[assignment]

    await db.commit()
    await db.refresh(deliverable)

    try:
        from app.services.auto_dispatch_service import (
            on_deliverable_submitted,
        )

        await on_deliverable_submitted(db, deliverable)
    except Exception:
        logger.exception(
            "Failed to dispatch deliverable_submission for %s",
            deliverable.id,
        )

    try:
        from app.services.webhook_service import trigger_partner_webhooks

        await trigger_partner_webhooks(
            db,
            partner_id=deliverable.assignment.partner_id,
            event_type="deliverable.submitted",
            data={
                "deliverable_id": str(deliverable.id),
                "assignment_id": str(deliverable.assignment_id),
                "title": deliverable.title,
                "submitted_at": deliverable.submitted_at.isoformat()
                if deliverable.submitted_at
                else None,
            },
        )
    except Exception:
        logger.exception(
            "Failed to trigger webhook for deliverable_submitted %s", deliverable.id
        )

    return build_deliverable_response(deliverable)


@router.post("/{deliverable_id}/review", response_model=DeliverableResponse)
async def review_deliverable(
    deliverable_id: UUID,
    data: DeliverableReview,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
) -> dict[str, Any]:
    if data.status not in ("approved", "returned", "rejected"):
        raise BadRequestException("Invalid review status")

    result = await db.execute(select(Deliverable).where(Deliverable.id == deliverable_id))
    deliverable = result.scalar_one_or_none()
    if not deliverable:
        raise NotFoundException("Deliverable not found")
    if deliverable.status not in ("submitted", "under_review"):
        raise BadRequestException("Deliverable is not ready for review")

    deliverable.status = data.status  # type: ignore[assignment]
    deliverable.review_comments = data.review_comments
    deliverable.reviewed_by = current_user.id
    deliverable.reviewed_at = datetime.now(UTC)

    if data.status == "approved":
        deliverable.client_visible = True

    await db.commit()
    await db.refresh(deliverable)

    try:
        from app.services.auto_dispatch_service import on_deliverable_reviewed

        await on_deliverable_reviewed(db, deliverable, data.status)
    except Exception:
        logger.exception(
            "Failed to dispatch review notifications for deliverable %s",
            deliverable.id,
        )

    # Only fire webhook on terminal outcomes that a partner cares about
    if data.status in ("approved", "returned", "rejected"):
        try:
            from app.models.partner_assignment import PartnerAssignment
            from app.services.webhook_service import trigger_partner_webhooks

            assignment_result = await db.execute(
                select(PartnerAssignment).where(
                    PartnerAssignment.id == deliverable.assignment_id
                )
            )
            assignment = assignment_result.scalar_one_or_none()
            if assignment:
                await trigger_partner_webhooks(
                    db,
                    partner_id=assignment.partner_id,
                    event_type=f"deliverable.{data.status}",
                    data={
                        "deliverable_id": str(deliverable.id),
                        "assignment_id": str(deliverable.assignment_id),
                        "title": deliverable.title,
                        "status": data.status,
                        "reviewed_at": deliverable.reviewed_at.isoformat()
                        if deliverable.reviewed_at
                        else None,
                    },
                )
        except Exception:
            logger.exception(
                "Failed to trigger webhook for deliverable review %s", deliverable.id
            )

    return build_deliverable_response(deliverable)


@router.get("/{deliverable_id}/download")
async def download_deliverable(
    deliverable_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> dict[str, str | None]:
    result = await db.execute(select(Deliverable).where(Deliverable.id == deliverable_id))
    deliverable = result.scalar_one_or_none()
    if not deliverable:
        raise NotFoundException("Deliverable not found")
    if not deliverable.file_path:
        raise NotFoundException("No file uploaded")

    url = storage_service.get_presigned_url(str(deliverable.file_path))
    return {"download_url": url}
