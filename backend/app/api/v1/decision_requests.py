"""Decision request management endpoints."""

import logging
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse

from app.api.deps import DB, CurrentUser, Pagination, require_internal
from app.core.config import settings
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.schemas.decision_request import (
    DecisionListResponse,
    DecisionRequestCreate,
    DecisionRequestResponse,
    DecisionRequestUpdate,
    DecisionRespondRequest,
)
from app.services.decision_service import decision_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/",
    response_model=DecisionRequestResponse,
    status_code=201,
    dependencies=[Depends(require_internal)],
)
async def create_decision_request(
    data: DecisionRequestCreate,
    db: DB,
    current_user: CurrentUser,
) -> DecisionRequestResponse:
    """Create a new decision request for a client."""
    decision = await decision_service.create(db, obj_in=data, created_by_id=current_user.id)

    try:
        from app.services.auto_dispatch_service import (
            on_decision_requested,
        )

        await on_decision_requested(db, decision)
    except Exception:
        logger.exception(
            "Failed to dispatch decision_request for %s",
            decision.id,
        )

    return DecisionRequestResponse.model_validate(decision)


@router.get("/", response_model=DecisionListResponse)
async def list_decision_requests(
    db: DB,
    current_user: CurrentUser,
    pagination: Pagination,
    client_id: uuid.UUID | None = None,
    status: str | None = None,
) -> DecisionListResponse:
    """List decision requests."""
    decisions, total = await decision_service.get_decision_requests_for_user(
        db,
        user_id=current_user.id,
        user_role=current_user.role,
        client_id=client_id,
        status=status,
        skip=pagination.skip,
        limit=pagination.limit,
    )
    return DecisionListResponse(
        decisions=[DecisionRequestResponse.model_validate(d) for d in decisions],
        total=total,
    )


@router.get("/pending", response_model=DecisionListResponse)
async def list_pending_decisions(
    db: DB,
    current_user: CurrentUser,
    pagination: Pagination,
) -> DecisionListResponse:
    """List pending decision requests for current user."""
    decisions, total = await decision_service.get_decision_requests_for_user(
        db,
        user_id=current_user.id,
        user_role=current_user.role,
        status="pending",
        skip=pagination.skip,
        limit=pagination.limit,
    )
    return DecisionListResponse(
        decisions=[DecisionRequestResponse.model_validate(d) for d in decisions],
        total=total,
    )


@router.get("/{decision_id}", response_model=DecisionRequestResponse)
async def get_decision_request(
    decision_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> DecisionRequestResponse:
    """Get a specific decision request."""
    decision = await decision_service.get(db, decision_id)
    if not decision:
        raise NotFoundException("Decision request not found")

    # Check access based on role
    # - Internal users can see all decisions for their clients
    # - Clients can only see their own decisions
    # - Partners can see decisions for their assignments
    has_access = await decision_service.check_access(db, decision, current_user)
    if not has_access:
        raise ForbiddenException("Access denied")

    return DecisionRequestResponse.model_validate(decision)


@router.post("/{decision_id}/respond", response_model=DecisionRequestResponse)
async def respond_to_decision(
    decision_id: uuid.UUID,
    data: DecisionRespondRequest,
    db: DB,
    current_user: CurrentUser,
) -> DecisionRequestResponse:
    """Respond to a decision request."""
    decision = await decision_service.get(db, decision_id)
    if not decision:
        raise NotFoundException("Decision request not found")

    if decision.status != "pending":
        raise BadRequestException("Decision is not pending")

    result = await decision_service.submit_response(db, decision, data.response, current_user.id)

    return DecisionRequestResponse.model_validate(result)


@router.patch("/{decision_id}", response_model=DecisionRequestResponse)
async def update_decision_request(
    decision_id: uuid.UUID,
    data: DecisionRequestUpdate,
    db: DB,
    current_user: CurrentUser,
) -> DecisionRequestResponse:
    """Update a decision request (internal use)."""
    decision = await decision_service.get(db, decision_id)
    if not decision:
        raise NotFoundException("Decision request not found")

    updated = await decision_service.update(db, db_obj=decision, obj_in=data)
    return DecisionRequestResponse.model_validate(updated)


@router.get("/{decision_id}/ical")
async def get_decision_ical(
    decision_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> PlainTextResponse:
    """Download an iCal (.ics) file for a decision deadline.

    Returns a calendar event that can be imported into any calendar application.
    Includes a 1-day reminder and a deep link back to the decision in the portal.
    """
    decision = await decision_service.get(db, decision_id)
    if not decision:
        raise NotFoundException("Decision request not found")

    has_access = await decision_service.check_access(db, decision, current_user)
    if not has_access:
        raise ForbiddenException("Access denied")

    # Build deep-link URL back to the portal
    portal_url = f"{settings.FRONTEND_URL}/portal/decisions/{decision_id}"

    # Determine event start/end datetimes
    now_stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    event_uid = f"decision-{decision_id}@amg-portal"

    if decision.deadline_date:
        if decision.deadline_time:
            # Timed event — use the specific time (treated as UTC)
            start_dt = datetime.combine(decision.deadline_date, decision.deadline_time)
            end_dt = start_dt + timedelta(hours=1)
            dtstart = f"DTSTART:{start_dt.strftime('%Y%m%dT%H%M%SZ')}"
            dtend = f"DTEND:{end_dt.strftime('%Y%m%dT%H%M%SZ')}"
        else:
            # All-day event
            end_date = decision.deadline_date + timedelta(days=1)
            dtstart = f"DTSTART;VALUE=DATE:{decision.deadline_date.strftime('%Y%m%d')}"
            dtend = f"DTEND;VALUE=DATE:{end_date.strftime('%Y%m%d')}"
    else:
        # No deadline set — use today as a placeholder all-day event
        today = datetime.now(UTC).date()
        dtstart = f"DTSTART;VALUE=DATE:{today.strftime('%Y%m%d')}"
        dtend = f"DTEND;VALUE=DATE:{(today + timedelta(days=1)).strftime('%Y%m%d')}"

    # Build description
    description_lines = [
        f"Decision Required: {decision.title}",
        "",
        decision.prompt,
    ]
    if decision.consequence_text:
        description_lines += ["", f"Note: {decision.consequence_text}"]
    description_lines += ["", f"Review and respond: {portal_url}"]
    description = "\\n".join(description_lines)

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AMG Portal//Decision Deadlines//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:{event_uid}",
        f"DTSTAMP:{now_stamp}",
        dtstart,
        dtend,
        f"SUMMARY:Decision Deadline: {decision.title}",
        f"DESCRIPTION:{description}",
        f"URL:{portal_url}",
        "STATUS:CONFIRMED",
        # 1-day reminder
        "BEGIN:VALARM",
        "TRIGGER:-P1D",
        "ACTION:DISPLAY",
        f"DESCRIPTION:Reminder: Decision deadline tomorrow — {decision.title}",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    ical_content = "\r\n".join(lines)

    safe_title = "".join(c if c.isalnum() or c in "-_" else "_" for c in decision.title)[:50]
    filename = f"decision-deadline-{safe_title}.ics"

    return PlainTextResponse(
        content=ical_content,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )
