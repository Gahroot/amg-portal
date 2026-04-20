"""Meeting scheduler API — client self-service booking with RM availability."""

import logging
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import DB, CurrentUser, require_client, require_internal, require_rm_or_above
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.schemas.meeting import (
    AvailableSlotsResponse,
    MeetingBook,
    MeetingCancelRequest,
    MeetingListResponse,
    MeetingRescheduleRequest,
    MeetingResponse,
    MeetingTypeResponse,
    RMAvailabilityCreate,
    RMAvailabilityResponse,
    RMAvailabilityUpdate,
    RMBlackoutCreate,
    RMBlackoutResponse,
)
from app.services import meeting_scheduler_service as svc

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Meeting Types (public to authenticated users) ────────────────────────────


@router.get("/types", response_model=list[MeetingTypeResponse])
async def list_meeting_types(db: DB) -> list[MeetingTypeResponse]:
    """Return the available meeting types (Quick Check-in, Standard, Extended)."""
    types = await svc.list_meeting_types(db)
    return [MeetingTypeResponse.model_validate(t) for t in types]


# ─── RM Availability Management (RM / internal only) ─────────────────────────


@router.get(
    "/availability",
    response_model=list[RMAvailabilityResponse],
    dependencies=[Depends(require_internal)],
)
async def get_my_availability(
    db: DB,
    current_user: CurrentUser,
) -> list[RMAvailabilityResponse]:
    """List the current RM's active availability windows."""
    windows = await svc.list_availability(db, current_user.id)
    return [RMAvailabilityResponse.model_validate(w) for w in windows]


@router.get(
    "/availability/rm/{rm_id}",
    response_model=list[RMAvailabilityResponse],
)
async def get_rm_availability(
    rm_id: uuid.UUID,
    db: DB,
) -> list[RMAvailabilityResponse]:
    """Return availability windows for a specific RM (used by client booking UI)."""
    windows = await svc.list_availability(db, rm_id)
    return [RMAvailabilityResponse.model_validate(w) for w in windows]


@router.post(
    "/availability",
    response_model=RMAvailabilityResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_internal)],
)
async def create_availability(
    data: RMAvailabilityCreate,
    db: DB,
    current_user: CurrentUser,
) -> RMAvailabilityResponse:
    """Add a recurring weekly availability window for the current RM."""
    window = await svc.create_availability(db, current_user.id, data.model_dump())
    return RMAvailabilityResponse.model_validate(window)


@router.patch(
    "/availability/{slot_id}",
    response_model=RMAvailabilityResponse,
    dependencies=[Depends(require_internal)],
)
async def update_availability(
    slot_id: uuid.UUID,
    data: RMAvailabilityUpdate,
    db: DB,
    current_user: CurrentUser,
) -> RMAvailabilityResponse:
    """Update an availability window owned by the current RM."""
    window = await svc.update_availability(
        db, slot_id, current_user.id, data.model_dump(exclude_unset=True)
    )
    if not window:
        raise NotFoundException("Availability slot not found")
    return RMAvailabilityResponse.model_validate(window)


@router.delete(
    "/availability/{slot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_internal)],
)
async def delete_availability(
    slot_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> None:
    """Remove an availability window owned by the current RM."""
    deleted = await svc.delete_availability(db, slot_id, current_user.id)
    if not deleted:
        raise NotFoundException("Availability slot not found")


# ─── Blackout Dates (RM only) ─────────────────────────────────────────────────


@router.get(
    "/blackouts",
    response_model=list[RMBlackoutResponse],
    dependencies=[Depends(require_internal)],
)
async def list_blackouts(
    db: DB,
    current_user: CurrentUser,
    from_date: date | None = Query(None),
) -> list[RMBlackoutResponse]:
    """List the current RM's blackout dates."""
    blackouts = await svc.list_blackouts(db, current_user.id, from_date)
    return [RMBlackoutResponse.model_validate(b) for b in blackouts]


@router.post(
    "/blackouts",
    response_model=RMBlackoutResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_internal)],
)
async def create_blackout(
    data: RMBlackoutCreate,
    db: DB,
    current_user: CurrentUser,
) -> RMBlackoutResponse:
    """Mark a date as unavailable for the current RM."""
    blackout = await svc.create_blackout(db, current_user.id, data.blackout_date, data.reason)
    return RMBlackoutResponse.model_validate(blackout)


@router.delete(
    "/blackouts/{blackout_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_internal)],
)
async def delete_blackout(
    blackout_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> None:
    """Remove a blackout date owned by the current RM."""
    deleted = await svc.delete_blackout(db, blackout_id, current_user.id)
    if not deleted:
        raise NotFoundException("Blackout not found")


# ─── Available Slots (clients call this to see bookable times) ────────────────


@router.get("/slots", response_model=AvailableSlotsResponse)
async def get_available_slots(
    db: DB,
    current_user: CurrentUser,
    meeting_type_id: uuid.UUID = Query(...),
    rm_id: uuid.UUID | None = Query(None),
    from_date: date = Query(default_factory=date.today),
    to_date: date | None = Query(None),
) -> AvailableSlotsResponse:
    """Return available booking slots for an RM.

    If rm_id is not supplied and the caller is a client, the client's assigned
    RM is used automatically.
    """
    # Resolve rm_id
    if not rm_id:
        from sqlalchemy import select

        from app.models.client_profile import ClientProfile

        profile_result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == current_user.id)
        )
        profile = profile_result.scalar_one_or_none()
        if not profile or not profile.assigned_rm_id:
            raise BadRequestException("rm_id is required (no RM is assigned to your profile)")
        rm_id = profile.assigned_rm_id

    if not to_date:
        to_date = from_date + timedelta(days=30)

    if (to_date - from_date).days > 90:
        raise BadRequestException("Date range cannot exceed 90 days")

    slots = await svc.get_available_slots(db, rm_id, meeting_type_id, from_date, to_date)
    return AvailableSlotsResponse(
        slots=slots,
        rm_id=rm_id,
        from_date=from_date,
        to_date=to_date,
    )


# ─── Meeting Booking (client) ─────────────────────────────────────────────────


@router.post(
    "/",
    response_model=MeetingResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_client)],
)
async def book_meeting(
    data: MeetingBook,
    db: DB,
    current_user: CurrentUser,
) -> MeetingResponse:
    """Client books a meeting with their RM."""
    # Resolve the Client record for this user
    client = await svc.get_client_for_user(db, current_user.id)
    if not client:
        raise NotFoundException("No client profile found for this user")

    try:
        meeting = await svc.book_meeting(
            db,
            client_id=client.id,
            booked_by_user_id=current_user.id,
            rm_id=client.rm_id,
            meeting_type_id=data.meeting_type_id,
            start_time=data.start_time,
            timezone=data.timezone,
            agenda=data.agenda,
        )
    except ValueError as exc:
        raise BadRequestException(str(exc)) from exc

    return MeetingResponse.model_validate(meeting)


# ─── Client Meeting List ──────────────────────────────────────────────────────


@router.get(
    "/my",
    response_model=MeetingListResponse,
    dependencies=[Depends(require_client)],
)
async def list_my_meetings(
    db: DB,
    current_user: CurrentUser,
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> MeetingListResponse:
    """List all meetings for the authenticated client."""
    client = await svc.get_client_for_user(db, current_user.id)
    if not client:
        return MeetingListResponse(meetings=[], total=0)

    meetings, total = await svc.list_meetings(
        db,
        client_id=client.id,
        status=status_filter,
        skip=skip,
        limit=limit,
    )
    return MeetingListResponse(
        meetings=[MeetingResponse.model_validate(m) for m in meetings],
        total=total,
    )


# ─── RM Meeting List (internal) ───────────────────────────────────────────────


@router.get(
    "/rm",
    response_model=MeetingListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_rm_meetings(
    db: DB,
    current_user: CurrentUser,
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> MeetingListResponse:
    """List all meetings for the current RM."""
    meetings, total = await svc.list_meetings(
        db,
        rm_id=current_user.id,
        status=status_filter,
        skip=skip,
        limit=limit,
    )
    return MeetingListResponse(
        meetings=[MeetingResponse.model_validate(m) for m in meetings],
        total=total,
    )


# ─── Meeting Detail ───────────────────────────────────────────────────────────


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> MeetingResponse:
    """Get a specific meeting. Accessible to RM or the client who booked it."""
    meeting = await svc.get_meeting(db, meeting_id)
    if not meeting:
        raise NotFoundException("Meeting not found")

    # Authorization check
    is_rm = meeting.rm_id == current_user.id
    is_client = meeting.booked_by_user_id == current_user.id
    if not (is_rm or is_client):
        raise ForbiddenException("Access denied")

    return MeetingResponse.model_validate(meeting)


# ─── RM Confirms a Meeting ────────────────────────────────────────────────────


@router.post(
    "/{meeting_id}/confirm",
    response_model=MeetingResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def confirm_meeting(
    meeting_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> MeetingResponse:
    """RM confirms a pending meeting request, creating a calendar event."""
    meeting = await svc.confirm_meeting(db, meeting_id, current_user.id)
    if not meeting:
        raise NotFoundException("Meeting not found or you are not the assigned RM")
    return MeetingResponse.model_validate(meeting)


# ─── Cancel a Meeting (both parties can cancel) ───────────────────────────────


@router.post("/{meeting_id}/cancel", response_model=MeetingResponse)
async def cancel_meeting(
    meeting_id: uuid.UUID,
    data: MeetingCancelRequest,
    db: DB,
    current_user: CurrentUser,
) -> MeetingResponse:
    """Cancel a meeting. Both the RM and the client can cancel."""
    meeting = await svc.get_meeting(db, meeting_id)
    if not meeting:
        raise NotFoundException("Meeting not found")

    is_rm = meeting.rm_id == current_user.id
    is_client = meeting.booked_by_user_id == current_user.id
    if not (is_rm or is_client):
        raise ForbiddenException("Access denied")

    if meeting.status in ("cancelled", "completed"):
        raise BadRequestException(f"Cannot cancel a meeting with status '{meeting.status}'")

    updated = await svc.cancel_meeting(db, meeting_id, current_user.id, data.reason)
    if not updated:
        raise NotFoundException("Meeting not found")
    return MeetingResponse.model_validate(updated)


# ─── Reschedule a Meeting ─────────────────────────────────────────────────────


@router.post("/{meeting_id}/reschedule", response_model=MeetingResponse)
async def reschedule_meeting(
    meeting_id: uuid.UUID,
    data: MeetingRescheduleRequest,
    db: DB,
    current_user: CurrentUser,
) -> MeetingResponse:
    """Reschedule a meeting. Both the RM and the client can request reschedule.

    Cancels the existing meeting and creates a new one at the new time.
    """
    meeting = await svc.get_meeting(db, meeting_id)
    if not meeting:
        raise NotFoundException("Meeting not found")

    is_rm = meeting.rm_id == current_user.id
    is_client = meeting.booked_by_user_id == current_user.id
    if not (is_rm or is_client):
        raise ForbiddenException("Access denied")

    if meeting.status in ("cancelled", "completed"):
        raise BadRequestException(f"Cannot reschedule a meeting with status '{meeting.status}'")

    new_meeting = await svc.reschedule_meeting(
        db,
        meeting_id=meeting_id,
        requested_by_id=current_user.id,
        new_start_time=data.new_start_time,
        timezone=data.timezone,
        reason=data.reason,
    )
    if not new_meeting:
        raise NotFoundException("Meeting not found")
    return MeetingResponse.model_validate(new_meeting)
