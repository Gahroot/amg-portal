"""Client profile management endpoints."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    DB,
    CurrentUser,
    RLSContext,
    require_admin,
    require_compliance,
    require_internal,
    require_rm_or_above,
    require_step_up,
)
from app.core.exceptions import ForbiddenException, NotFoundException, ValidationException
from app.models.client_profile import ClientProfile
from app.models.enums import UserRole
from app.schemas.client import UpcomingDateItemResponse
from app.schemas.client_profile import (
    ClientProfileCreate,
    ClientProfileListResponse,
    ClientProfileResponse,
    ClientProfileUpdate,
    ClientProvisionRequest,
    ComplianceCertificate,
    ComplianceReviewRequest,
    DuplicateCheckRequest,
    DuplicateMatchResponse,
    IntelligenceFileSchema,
    MDApprovalRequest,
)
from app.schemas.client_timeline import TimelineListResponse
from app.services.client_dates_service import UpcomingDateItem, get_upcoming_dates
from app.services.client_service import client_service
from app.services.duplicate_detection_service import check_duplicates

router = APIRouter()


@router.post(
    "/",
    response_model=ClientProfileResponse,
    status_code=201,
    dependencies=[Depends(require_rm_or_above)],
)
async def create_client_intake(
    data: ClientProfileCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    return await client_service.create_intake(db, data=data, created_by_id=current_user.id)


@router.get("/", response_model=ClientProfileListResponse, dependencies=[Depends(require_internal)])
async def list_client_profiles(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    compliance_status: str | None = None,
    approval_status: str | None = None,
    assigned_rm_id: uuid.UUID | None = None,
    search: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> Any:
    filters = []
    if compliance_status:
        filters.append(ClientProfile.compliance_status == compliance_status)
    if approval_status:
        filters.append(ClientProfile.approval_status == approval_status)

    # RMs can only see their own assigned clients — ignore any caller-supplied
    # assigned_rm_id and force-scope to the current user.
    if current_user.role == UserRole.relationship_manager:
        filters.append(ClientProfile.assigned_rm_id == current_user.id)
    elif assigned_rm_id:
        filters.append(ClientProfile.assigned_rm_id == assigned_rm_id)

    if search:
        pattern = f"%{search}%"
        filters.append(
            ClientProfile.legal_name.ilike(pattern) | ClientProfile.primary_email.ilike(pattern)
        )

    profiles, total = await client_service.get_multi(db, skip=skip, limit=limit, filters=filters)
    return ClientProfileListResponse(profiles=profiles, total=total)  # type: ignore[arg-type]


@router.post(
    "/compare",
    response_model=list[ClientProfileResponse],
    dependencies=[Depends(require_internal)],
)
async def compare_clients(
    ids: list[uuid.UUID],
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    """Return detailed data for 2-4 client profiles for side-by-side comparison."""
    if len(ids) < 2 or len(ids) > 4:
        raise ValidationException("Please select 2 to 4 clients to compare")

    profiles = []
    for profile_id in ids:
        profile = await client_service.get(db, profile_id)
        if not profile:
            raise NotFoundException("One or more client profiles not found")
        if (
            current_user.role == UserRole.relationship_manager
            and profile.assigned_rm_id != current_user.id
        ):
            raise ForbiddenException("Access denied to one or more client profiles")
        profiles.append(profile)

    return profiles


@router.post(
    "/check-duplicates",
    response_model=list[DuplicateMatchResponse],
    dependencies=[Depends(require_rm_or_above)],
)
async def check_client_duplicates(
    data: DuplicateCheckRequest,
    db: DB,
    _rls: RLSContext,
) -> list[DuplicateMatchResponse]:
    """Check for potential duplicate client profiles.

    Accepts a partial client record (name, email, phone) and returns a list
    of existing profiles that may be duplicates, with similarity scores and
    match reasons.  Intended to be called during client intake on field blur.
    """
    matches = await check_duplicates(
        db,
        legal_name=data.legal_name,
        primary_email=str(data.primary_email) if data.primary_email else None,
        phone=data.phone,
        exclude_id=data.exclude_id,
    )
    return [
        DuplicateMatchResponse(
            client_id=m.client_id,
            legal_name=m.legal_name,
            display_name=m.display_name,
            primary_email=m.primary_email,
            phone=m.phone,
            similarity_score=m.similarity_score,
            match_reasons=m.match_reasons,
        )
        for m in matches
    ]


@router.get(
    "/my-portfolio",
    response_model=ClientProfileListResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def get_my_portfolio(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> Any:
    profiles, total = await client_service.get_rm_portfolio(
        db, current_user.id, skip=skip, limit=limit
    )
    return ClientProfileListResponse(profiles=profiles, total=total)  # type: ignore[arg-type]


@router.get(
    "/upcoming-dates",
    response_model=list[UpcomingDateItemResponse],
    dependencies=[Depends(require_internal)],
)
async def list_upcoming_dates(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    days_ahead: int = Query(14, ge=1, le=90),
) -> list[UpcomingDateItemResponse]:
    """Return upcoming client birthdays and important dates within *days_ahead* days.

    RMs see only their own clients. MDs and other internal roles see all clients.
    """
    rm_id: uuid.UUID | None = None
    if current_user.role == UserRole.relationship_manager:
        rm_id = current_user.id

    items: list[UpcomingDateItem] = await get_upcoming_dates(db, days_ahead=days_ahead, rm_id=rm_id)
    return [
        UpcomingDateItemResponse(
            client_id=item.client_id,
            client_name=item.client_name,
            rm_id=item.rm_id,
            date_type=item.date_type,
            label=item.label,
            days_until=item.days_until,
            occurs_on=item.occurs_on,
            years_since=item.years_since,
        )
        for item in items
    ]


@router.get(
    "/{profile_id}",
    response_model=ClientProfileResponse,
    dependencies=[
        Depends(require_internal),
        Depends(require_step_up("view_pii")),
    ],
)
async def get_client_profile(
    profile_id: uuid.UUID, db: DB, current_user: CurrentUser, _rls: RLSContext
) -> Any:
    profile = await client_service.get(db, profile_id)
    if not profile:
        raise NotFoundException("Profile not found")
    if (
        current_user.role == UserRole.relationship_manager
        and profile.assigned_rm_id != current_user.id
    ):
        raise ForbiddenException("Access denied: client not in your portfolio")
    return profile


@router.patch(
    "/{profile_id}",
    response_model=ClientProfileResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def update_client_profile(
    profile_id: uuid.UUID,
    data: ClientProfileUpdate,
    db: DB,
    _rls: RLSContext,
) -> Any:
    profile = await client_service.get(db, profile_id)
    if not profile:
        raise NotFoundException("Profile not found")
    return await client_service.update(db, db_obj=profile, obj_in=data)


@router.patch(
    "/{profile_id}/intelligence",
    response_model=ClientProfileResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def update_intelligence_file(
    profile_id: uuid.UUID,
    data: IntelligenceFileSchema,
    db: DB,
    _rls: RLSContext,
) -> Any:
    return await client_service.update_intelligence_file(db, profile_id, data)


@router.post(
    "/{profile_id}/compliance-review",
    response_model=ClientProfileResponse,
    dependencies=[Depends(require_compliance)],
)
async def submit_compliance_review(
    profile_id: uuid.UUID,
    review: ComplianceReviewRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    return await client_service.submit_compliance_review(
        db, profile_id=profile_id, review=review, reviewer_id=current_user.id
    )


@router.get(
    "/{profile_id}/compliance-certificate",
    response_model=ComplianceCertificate,
    dependencies=[Depends(require_internal)],
)
async def get_compliance_certificate(
    profile_id: uuid.UUID,
    db: DB,
    _rls: RLSContext,
) -> Any:
    return await client_service.generate_compliance_certificate(db, profile_id)


@router.post(
    "/{profile_id}/md-approval",
    response_model=ClientProfileResponse,
    dependencies=[Depends(require_admin)],
)
async def submit_md_approval(
    profile_id: uuid.UUID,
    approval: MDApprovalRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    return await client_service.submit_md_approval(
        db, profile_id=profile_id, approval=approval, approver_id=current_user.id
    )


@router.post(
    "/{profile_id}/provision",
    response_model=ClientProfileResponse,
    dependencies=[Depends(require_admin)],
)
async def provision_client(
    profile_id: uuid.UUID,
    request: ClientProvisionRequest,
    db: DB,
    _rls: RLSContext,
) -> Any:
    return await client_service.provision_client_user(db, profile_id=profile_id, request=request)


@router.get("/{profile_id}/timeline", response_model=TimelineListResponse)
async def get_client_timeline(
    profile_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    event_types: str | None = Query(None, description="Comma-separated event types"),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> TimelineListResponse:
    """Get aggregated timeline of all events for a client profile."""
    from app.schemas.client_timeline import TimelineEventType
    from app.services.client_timeline_service import client_timeline_service

    parsed_types: list[TimelineEventType] | None = None
    if event_types:
        parsed_types = [TimelineEventType(t.strip()) for t in event_types.split(",")]

    return await client_timeline_service.get_timeline(
        db,
        profile_id,
        event_types=parsed_types,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )
