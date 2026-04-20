"""Scheduling and coordination endpoints."""

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import DB, CurrentUser, require_internal
from app.core.exceptions import NotFoundException
from app.schemas.scheduled_event import (
    ConflictCheckResponse,
    ScheduledEventCreate,
    ScheduledEventListResponse,
    ScheduledEventResponse,
    ScheduledEventUpdate,
)
from app.services import scheduling_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/events",
    response_model=ScheduledEventListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_events(
    db: DB,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    event_type: str | None = Query(None),
) -> ScheduledEventListResponse:
    """List scheduled events with optional filters."""
    events, total = await scheduling_service.list_events(
        db, skip=skip, limit=limit, status=status_filter, event_type=event_type
    )
    return ScheduledEventListResponse(
        events=[ScheduledEventResponse.model_validate(e) for e in events],
        total=total,
    )


@router.post(
    "/events",
    response_model=ScheduledEventResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_internal)],
)
async def create_event(
    data: ScheduledEventCreate,
    db: DB,
    current_user: CurrentUser,
) -> ScheduledEventResponse:
    """Create a new scheduled event."""
    event_data = data.model_dump(exclude_unset=True)
    event = await scheduling_service.create_event(
        db, event_data=event_data, organizer_id=current_user.id
    )
    return ScheduledEventResponse.model_validate(event)


@router.get(
    "/events/{event_id}",
    response_model=ScheduledEventResponse,
    dependencies=[Depends(require_internal)],
)
async def get_event(
    event_id: uuid.UUID,
    db: DB,
) -> ScheduledEventResponse:
    """Get a scheduled event by ID."""
    event = await scheduling_service.get_event(db, event_id)
    if not event:
        raise NotFoundException("Event not found")
    return ScheduledEventResponse.model_validate(event)


@router.patch(
    "/events/{event_id}",
    response_model=ScheduledEventResponse,
    dependencies=[Depends(require_internal)],
)
async def update_event(
    event_id: uuid.UUID,
    data: ScheduledEventUpdate,
    db: DB,
) -> ScheduledEventResponse:
    """Update a scheduled event."""
    update_data = data.model_dump(exclude_unset=True)
    event = await scheduling_service.update_event(db, event_id, update_data)
    if not event:
        raise NotFoundException("Event not found")
    return ScheduledEventResponse.model_validate(event)


@router.delete(
    "/events/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_internal)],
)
async def delete_event(
    event_id: uuid.UUID,
    db: DB,
) -> None:
    """Delete a scheduled event."""
    deleted = await scheduling_service.delete_event(db, event_id)
    if not deleted:
        raise NotFoundException("Event not found")


@router.get(
    "/my-schedule",
    response_model=ScheduledEventListResponse,
)
async def get_my_schedule(
    db: DB,
    current_user: CurrentUser,
    start: datetime = Query(...),
    end: datetime = Query(...),
) -> ScheduledEventListResponse:
    """Get current user's events within a date range."""
    events = await scheduling_service.get_user_schedule(db, current_user.id, start, end)
    return ScheduledEventListResponse(
        events=[ScheduledEventResponse.model_validate(e) for e in events],
        total=len(events),
    )


@router.get(
    "/conflicts",
    response_model=ConflictCheckResponse,
)
async def check_conflicts(
    db: DB,
    current_user: CurrentUser,
    start: datetime = Query(...),
    end: datetime = Query(...),
) -> ConflictCheckResponse:
    """Check for scheduling conflicts for the current user."""
    conflicts = await scheduling_service.check_conflicts(db, current_user.id, start, end)
    return ConflictCheckResponse(
        has_conflicts=len(conflicts) > 0,
        conflicts=[ScheduledEventResponse.model_validate(c) for c in conflicts],
    )


@router.post(
    "/events/{event_id}/confirm",
    response_model=ScheduledEventResponse,
)
async def confirm_event(
    event_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> ScheduledEventResponse:
    """Confirm a scheduled event."""
    event = await scheduling_service.update_event_status(db, event_id, "confirmed", current_user.id)
    if not event:
        raise NotFoundException("Event not found")
    return ScheduledEventResponse.model_validate(event)


@router.post(
    "/events/{event_id}/cancel",
    response_model=ScheduledEventResponse,
)
async def cancel_event(
    event_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> ScheduledEventResponse:
    """Cancel a scheduled event."""
    event = await scheduling_service.update_event_status(db, event_id, "cancelled", current_user.id)
    if not event:
        raise NotFoundException("Event not found")
    return ScheduledEventResponse.model_validate(event)
