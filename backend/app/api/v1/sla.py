"""SLA tracker endpoints — clock management, breach detection."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.api.deps import DB, CurrentUser, Pagination, require_internal
from app.core.exceptions import NotFoundException
from app.models.enums import CommunicationType
from app.models.sla_tracker import SLATracker
from app.models.user import User
from app.schemas.sla_tracker import (
    SLABreachAlertResponse,
    SLACreate,
    SLATrackerListResponse,
    SLATrackerResponse,
)
from app.services.sla_service import (
    check_sla_breaches,
    get_breached_slas_with_details,
    get_sla_trackers_with_assignee_info,
    respond_to_sla,
    start_sla_clock,
)

router = APIRouter()


@router.get("/", response_model=SLATrackerListResponse, dependencies=[Depends(require_internal)])
async def list_sla_trackers(
    db: DB,
    pagination: Pagination,
    breach_status: str | None = None,
    entity_type: str | None = None,
) -> SLATrackerListResponse:
    """List SLA trackers with filters."""
    trackers, total = await get_sla_trackers_with_assignee_info(
        db,
        skip=pagination.skip,
        limit=pagination.limit,
        breach_status=breach_status,
        entity_type=entity_type,
    )
    return SLATrackerListResponse(trackers=trackers, total=total)  # type: ignore[arg-type]


@router.get(
    "/breaches",
    response_model=list[SLABreachAlertResponse],
    dependencies=[Depends(require_internal)],
)
async def get_sla_breaches(
    db: DB,
    include_approaching: bool = Query(True),
) -> list[SLABreachAlertResponse]:
    """Get current and approaching SLA breaches."""
    await check_sla_breaches(db)  # Update breach statuses
    details = await get_breached_slas_with_details(db, include_approaching=include_approaching)

    return [
        SLABreachAlertResponse(
            id=d["id"],  # type: ignore[arg-type]
            entity_type=d["entity_type"],  # type: ignore[arg-type]
            entity_id=d["entity_id"],  # type: ignore[arg-type]
            communication_type=d["communication_type"],  # type: ignore[arg-type]
            sla_hours=d["sla_hours"],  # type: ignore[arg-type]
            started_at=d["started_at"],  # type: ignore[arg-type]
            breach_status=d["breach_status"],  # type: ignore[arg-type]
            assigned_to=d["assigned_to"],  # type: ignore[arg-type]
            hours_elapsed=d["hours_elapsed"],  # type: ignore[arg-type]
            hours_remaining=d.get("hours_remaining"),  # type: ignore[arg-type]
            overdue_hours=d.get("overdue_hours"),  # type: ignore[arg-type]
        )
        for d in details
    ]


@router.post("/", response_model=SLATrackerResponse, dependencies=[Depends(require_internal)])
async def create_sla_tracker(
    data: SLACreate,
    db: DB,
) -> SLATrackerResponse:
    """Start SLA clock for a communication."""
    tracker = await start_sla_clock(
        db=db,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        communication_type=CommunicationType(data.communication_type),
        assigned_to=data.assigned_to,
        sla_hours=data.sla_hours,
    )

    # Get assignee info
    assignee_result = await db.execute(select(User).where(User.id == tracker.assigned_to))
    assignee = assignee_result.scalar_one_or_none()

    return SLATrackerResponse(
        id=tracker.id,
        entity_type=tracker.entity_type,
        entity_id=tracker.entity_id,
        communication_type=tracker.communication_type,
        sla_hours=tracker.sla_hours,
        started_at=tracker.started_at,
        responded_at=tracker.responded_at,
        breach_status=tracker.breach_status,
        assigned_to=tracker.assigned_to,
        assigned_to_email=assignee.email if assignee else None,
        assigned_to_name=assignee.full_name if assignee else None,
        created_at=tracker.created_at,
        updated_at=tracker.updated_at,
    )


@router.post(
    "/{tracker_id}/respond",
    response_model=SLATrackerResponse,
    dependencies=[Depends(require_internal)],
)
async def respond_to_sla_endpoint(
    tracker_id: UUID,
    db: DB,
    current_user: CurrentUser,
) -> SLATrackerResponse:
    """Mark SLA as responded."""
    tracker = await respond_to_sla(db, tracker_id, current_user)

    # Get assignee info
    assignee_result = await db.execute(select(User).where(User.id == tracker.assigned_to))
    assignee = assignee_result.scalar_one_or_none()

    return SLATrackerResponse(
        id=tracker.id,
        entity_type=tracker.entity_type,
        entity_id=tracker.entity_id,
        communication_type=tracker.communication_type,
        sla_hours=tracker.sla_hours,
        started_at=tracker.started_at,
        responded_at=tracker.responded_at,
        breach_status=tracker.breach_status,
        assigned_to=tracker.assigned_to,
        assigned_to_email=assignee.email if assignee else None,
        assigned_to_name=assignee.full_name if assignee else None,
        created_at=tracker.created_at,
        updated_at=tracker.updated_at,
    )


@router.get(
    "/{tracker_id}",
    response_model=SLATrackerResponse,
    dependencies=[Depends(require_internal)],
)
async def get_sla_tracker(
    tracker_id: UUID,
    db: DB,
) -> SLATrackerResponse:
    """Get a single SLA tracker by ID."""
    result = await db.execute(select(SLATracker).where(SLATracker.id == tracker_id))
    tracker = result.scalar_one_or_none()
    if not tracker:
        raise NotFoundException("SLA tracker not found")

    # Get assignee info
    assignee_result = await db.execute(select(User).where(User.id == tracker.assigned_to))
    assignee = assignee_result.scalar_one_or_none()

    return SLATrackerResponse(
        id=tracker.id,
        entity_type=tracker.entity_type,
        entity_id=tracker.entity_id,
        communication_type=tracker.communication_type,
        sla_hours=tracker.sla_hours,
        started_at=tracker.started_at,
        responded_at=tracker.responded_at,
        breach_status=tracker.breach_status,
        assigned_to=tracker.assigned_to,
        assigned_to_email=assignee.email if assignee else None,
        assigned_to_name=assignee.full_name if assignee else None,
        created_at=tracker.created_at,
        updated_at=tracker.updated_at,
    )


@router.get(
    "/entity/{entity_type}/{entity_id}",
    response_model=SLATrackerListResponse,
    dependencies=[Depends(require_internal)],
)
async def get_entity_sla_trackers(
    entity_type: str,
    entity_id: str,
    db: DB,
    pagination: Pagination,
) -> SLATrackerListResponse:
    """Get SLA trackers for a specific entity."""
    trackers, total = await get_sla_trackers_with_assignee_info(
        db,
        skip=pagination.skip,
        limit=pagination.limit,
        entity_type=entity_type,
    )

    # Filter by entity_id
    filtered = [t for t in trackers if t["entity_id"] == entity_id]

    return SLATrackerListResponse(
        trackers=filtered,  # type: ignore[arg-type]
        total=len(filtered),
    )
