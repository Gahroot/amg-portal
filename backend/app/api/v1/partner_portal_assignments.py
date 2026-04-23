"""Partner portal — assignment and deliverable endpoints."""

import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, File, Form, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentPartner, CurrentUser, RLSContext
from app.api.v1.deliverables import build_deliverable_response
from app.api.v1.partner_assignments import build_assignment_response
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.deliverable import Deliverable
from app.models.enums import AssignmentStatus
from app.models.partner_assignment import AssignmentHistory, PartnerAssignment
from app.schemas.deliverable import BulkSubmitResponse, DeliverableListResponse, DeliverableResponse
from app.schemas.partner_assignment import (
    AssignmentHistoryEntry,
    AssignmentListResponse,
    AssignmentResponse,
    DeclineRequest,
)
from app.services.storage import ALLOWED_MIME_TYPES, MAX_FILE_SIZE, storage_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/assignments", response_model=AssignmentListResponse)
async def get_my_assignments(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> Any:
    result = await db.execute(
        select(PartnerAssignment)
        .options(selectinload(PartnerAssignment.partner), selectinload(PartnerAssignment.program))
        .where(PartnerAssignment.partner_id == partner.id)
        .order_by(PartnerAssignment.created_at.desc())
    )
    assignments = result.scalars().all()
    return AssignmentListResponse(
        assignments=[build_assignment_response(a) for a in assignments],  # type: ignore[misc]
        total=len(assignments),
    )


@router.get("/assignments/{assignment_id}", response_model=AssignmentResponse)
async def get_my_assignment(
    assignment_id: UUID,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> Any:
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
        raise NotFoundException("Assignment not found")
    if assignment.partner_id != partner.id:
        raise ForbiddenException("Not your assignment")
    return build_assignment_response(assignment)


@router.post("/assignments/{assignment_id}/accept", response_model=AssignmentResponse)
async def accept_my_assignment(
    assignment_id: UUID,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> Any:
    """Accept a dispatched assignment.

    Sets accepted_at (SLA clock start), records history, and notifies the coordinator.
    """
    result = await db.execute(
        select(PartnerAssignment)
        .options(selectinload(PartnerAssignment.partner), selectinload(PartnerAssignment.program))
        .where(PartnerAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise NotFoundException("Assignment not found")
    if assignment.partner_id != partner.id:
        raise ForbiddenException("Not your assignment")
    if assignment.status != AssignmentStatus.dispatched:
        raise BadRequestException("Only dispatched assignments can be accepted")

    now = datetime.now(UTC)
    assignment.status = AssignmentStatus.accepted
    assignment.accepted_at = now  # SLA clock starts here

    db.add(
        AssignmentHistory(
            assignment_id=assignment.id,
            actor_id=current_user.id,
            event="accepted",
        )
    )
    await db.commit()

    try:
        from app.services.auto_dispatch_service import on_assignment_accepted

        await on_assignment_accepted(db, assignment)
    except Exception:
        logger.exception("Failed to send assignment_accepted notification for %s", assignment.id)

    try:
        from app.services.webhook_service import trigger_partner_webhooks

        await trigger_partner_webhooks(
            db,
            partner_id=assignment.partner_id,
            event_type="assignment.accepted",
            data={
                "assignment_id": str(assignment.id),
                "program_id": str(assignment.program_id),
                "accepted_at": now.isoformat(),
            },
        )
    except Exception:
        logger.exception("Failed to trigger webhook for assignment_accepted %s", assignment.id)

    result = await db.execute(
        select(PartnerAssignment)
        .options(selectinload(PartnerAssignment.partner), selectinload(PartnerAssignment.program))
        .where(PartnerAssignment.id == assignment.id)
    )
    assignment = result.scalar_one()
    return build_assignment_response(assignment)


@router.post("/assignments/{assignment_id}/decline", response_model=AssignmentResponse)
async def decline_my_assignment(
    assignment_id: UUID,
    data: DeclineRequest,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> Any:
    """Decline a dispatched assignment.

    A reason is required. Records history and notifies coordinator and RM for reassignment.
    """
    result = await db.execute(
        select(PartnerAssignment)
        .options(selectinload(PartnerAssignment.partner), selectinload(PartnerAssignment.program))
        .where(PartnerAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise NotFoundException("Assignment not found")
    if assignment.partner_id != partner.id:
        raise ForbiddenException("Not your assignment")
    if assignment.status != AssignmentStatus.dispatched:
        raise BadRequestException("Only dispatched assignments can be declined")

    now = datetime.now(UTC)
    assignment.status = AssignmentStatus.declined
    assignment.declined_at = now
    assignment.decline_reason = data.reason

    # Immutable history entry
    db.add(
        AssignmentHistory(
            assignment_id=assignment.id,
            actor_id=current_user.id,
            event="declined",
            reason=data.reason,
        )
    )
    await db.commit()

    try:
        from app.services.auto_dispatch_service import on_assignment_declined

        await on_assignment_declined(db, assignment)
    except Exception:
        logger.exception("Failed to send assignment_declined notification for %s", assignment.id)

    try:
        from app.services.webhook_service import trigger_partner_webhooks

        await trigger_partner_webhooks(
            db,
            partner_id=assignment.partner_id,
            event_type="assignment.declined",
            data={
                "assignment_id": str(assignment.id),
                "program_id": str(assignment.program_id),
                "declined_at": now.isoformat(),
                "reason": data.reason,
            },
        )
    except Exception:
        logger.exception("Failed to trigger webhook for assignment_declined %s", assignment.id)

    result = await db.execute(
        select(PartnerAssignment)
        .options(selectinload(PartnerAssignment.partner), selectinload(PartnerAssignment.program))
        .where(PartnerAssignment.id == assignment.id)
    )
    assignment = result.scalar_one()
    return build_assignment_response(assignment)


@router.get(
    "/assignments/{assignment_id}/history",
    response_model=list[AssignmentHistoryEntry],
)
async def get_assignment_history(
    assignment_id: UUID,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> Any:
    """Return the accept/decline history for one of the partner's assignments."""
    owner_result = await db.execute(
        select(PartnerAssignment.partner_id).where(PartnerAssignment.id == assignment_id)
    )
    row = owner_result.one_or_none()
    if not row:
        raise NotFoundException("Assignment not found")
    if row[0] != partner.id:
        raise ForbiddenException("Not your assignment")

    history_result = await db.execute(
        select(AssignmentHistory)
        .where(AssignmentHistory.assignment_id == assignment_id)
        .order_by(AssignmentHistory.created_at)
    )
    return history_result.scalars().all()


@router.get("/deliverables", response_model=DeliverableListResponse)
async def get_my_deliverables(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> Any:
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

    return DeliverableListResponse(
        deliverables=[
            DeliverableResponse.model_validate(build_deliverable_response(d))
            for d in deliverables
        ],
        total=len(deliverables),
    )


@router.post("/deliverables/bulk-submit", response_model=BulkSubmitResponse, status_code=207)
async def bulk_submit_deliverables(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
    files: list[UploadFile] = File(...),
    metadata: str = Form(...),
) -> dict[str, Any]:
    """Submit multiple deliverable files in one request.

    ``metadata`` is a JSON array of objects with shape::

        [{"assignment_id": "<uuid>", "title": "<str|null>", "notes": "<str|null>"}, ...]

    The array length must match the number of uploaded files.  Each file is
    matched positionally to its metadata entry.  Only assignments with status
    ``accepted`` are permitted.  Validation errors per file are returned
    inline — the overall HTTP status is 207 Multi-Status so callers can
    inspect each result individually.
    """
    try:
        items: list[dict[str, Any]] = json.loads(metadata)
    except (json.JSONDecodeError, ValueError) as exc:
        raise BadRequestException("metadata must be a valid JSON array") from exc

    if not isinstance(items, list) or len(items) != len(files):
        raise BadRequestException(
            f"metadata array length ({len(items)}) must equal number of files ({len(files)})"
        )

    if not files:
        raise BadRequestException("At least one file is required")

    # Fetch accepted assignments that belong to this partner
    assignments_result = await db.execute(
        select(PartnerAssignment).where(
            PartnerAssignment.partner_id == partner.id,
            PartnerAssignment.status == "accepted",
        )
    )
    valid_assignments: dict[str, PartnerAssignment] = {
        str(a.id): a for a in assignments_result.scalars().all()
    }

    results: list[dict[str, Any]] = []

    for file, item in zip(files, items, strict=True):
        filename = file.filename or "upload"
        assignment_id_str = str(item.get("assignment_id", ""))

        # ── Validate assignment ────────────────────────────────────────────
        if assignment_id_str not in valid_assignments:
            results.append(
                {
                    "filename": filename,
                    "success": False,
                    "deliverable_id": None,
                    "error": "Assignment not found or not accepted",
                }
            )
            continue

        # ── Validate file type ─────────────────────────────────────────────
        content_type = file.content_type or "application/octet-stream"
        if content_type not in ALLOWED_MIME_TYPES:
            results.append(
                {
                    "filename": filename,
                    "success": False,
                    "deliverable_id": None,
                    "error": f"File type '{content_type}' is not allowed",
                }
            )
            continue

        # ── Validate file size ─────────────────────────────────────────────
        contents = await file.read()
        file_size = len(contents)

        if file_size > MAX_FILE_SIZE:
            results.append(
                {
                    "filename": filename,
                    "success": False,
                    "deliverable_id": None,
                    "error": "File exceeds the 50 MB size limit",
                }
            )
            continue

        # ── Upload ─────────────────────────────────────────────────────────
        try:
            await file.seek(0)
            object_path, stored_size = await storage_service.upload_file(
                file, f"deliverables/{assignment_id_str}"
            )
        except Exception:
            logger.exception("Failed to upload file %s for bulk submit", filename)
            results.append(
                {
                    "filename": filename,
                    "success": False,
                    "deliverable_id": None,
                    "error": "File upload failed — please try again",
                }
            )
            continue

        # ── Create & submit deliverable record ─────────────────────────────
        title: str = item.get("title") or filename
        notes: str | None = item.get("notes") or None

        deliverable = Deliverable(
            assignment_id=assignment_id_str,
            title=title,
            deliverable_type="document",
            description=notes,
            file_path=object_path,
            file_name=filename,
            file_size=stored_size,
            submitted_at=datetime.now(UTC),
            submitted_by=current_user.id,
            status="submitted",
        )
        db.add(deliverable)
        await db.flush()  # get the generated id before commit

        results.append(
            {
                "filename": filename,
                "success": True,
                "deliverable_id": deliverable.id,
                "error": None,
            }
        )

    await db.commit()

    succeeded = sum(1 for r in results if r["success"])
    return {
        "results": results,
        "total": len(results),
        "succeeded": succeeded,
        "failed": len(results) - succeeded,
    }


@router.get("/calendar")
async def get_my_calendar_events(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
    include_completed: bool = Query(True),
    program_id: UUID | None = None,
) -> list[dict[str, Any]]:
    """Return all assignments and deliverables with due dates as calendar events."""
    # Fetch all partner assignments with their deliverables and program info
    query = (
        select(PartnerAssignment)
        .options(
            selectinload(PartnerAssignment.program),
            selectinload(PartnerAssignment.deliverables),
        )
        .where(PartnerAssignment.partner_id == partner.id)
    )

    if program_id:
        query = query.where(PartnerAssignment.program_id == program_id)

    if not include_completed:
        query = query.where(PartnerAssignment.status.notin_(["completed", "cancelled"]))

    result = await db.execute(query)
    assignments = result.scalars().all()

    events: list[dict[str, Any]] = []

    for a in assignments:
        program_title = a.program.title if a.program else None
        # Assignment event (uses assignment due_date)
        if a.due_date:
            events.append(
                {
                    "id": str(a.id),
                    "type": "assignment",
                    "title": a.title,
                    "due_date": str(a.due_date),
                    "status": a.status,
                    "program_title": program_title,
                    "program_id": str(a.program_id) if a.program_id else None,
                    "assignment_id": str(a.id),
                    "assignment_title": None,
                    "deliverable_type": None,
                }
            )

        # Deliverable events
        for d in a.deliverables:
            if not d.due_date:
                continue
            if not include_completed and d.status in ("approved", "rejected"):
                continue
            events.append(
                {
                    "id": str(d.id),
                    "type": "deliverable",
                    "title": d.title,
                    "due_date": str(d.due_date),
                    "status": d.status,
                    "program_title": program_title,
                    "program_id": str(a.program_id) if a.program_id else None,
                    "assignment_id": str(a.id),
                    "assignment_title": a.title,
                    "deliverable_type": d.deliverable_type,
                }
            )

    # Sort by due_date ascending
    events.sort(key=lambda e: e["due_date"])
    return events
