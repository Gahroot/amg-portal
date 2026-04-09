"""NPS Survey API endpoints."""
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.api.deps import (
    DB,
    CurrentUser,
    require_coordinator_or_above,
    require_internal,
    require_rm_or_above,
)
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.enums import NPSFollowUpStatus, NPSSurveyStatus
from app.schemas.nps_survey import (
    NPSFollowUpListResponse,
    NPSFollowUpResponse,
    NPSFollowUpUpdate,
    NPSResponseCreate,
    NPSResponseDetail,
    NPSResponseListResponse,
    NPSSurveyCreate,
    NPSSurveyListResponse,
    NPSSurveyResponse,
    NPSSurveyStats,
    NPSSurveyUpdate,
    NPSTrendAnalysis,
)
from app.services.nps_survey_service import (
    nps_follow_up_service,
    nps_response_service,
    nps_survey_service,
)

router = APIRouter()


# ==================== Survey Endpoints ====================


@router.post(
    "/",
    response_model=NPSSurveyResponse,
    status_code=201,
    dependencies=[Depends(require_rm_or_above)],
)
async def create_nps_survey(
    data: NPSSurveyCreate,
    db: DB,
    current_user: CurrentUser,
) -> Any:
    """Create a new NPS survey."""
    return await nps_survey_service.create_survey(db, data=data, created_by_id=current_user.id)


@router.get(
    "/",
    response_model=NPSSurveyListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_nps_surveys(
    db: DB,
    status: str | None = Query(None, description="Filter by status"),
    year: int | None = Query(None, description="Filter by year"),
    quarter: int | None = Query(None, ge=1, le=4, description="Filter by quarter"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> Any:
    """List NPS surveys with optional filtering."""
    surveys, total = await nps_survey_service.get_surveys(
        db,
        status=status,
        year=year,
        quarter=quarter,
        skip=skip,
        limit=limit,
    )
    return NPSSurveyListResponse(surveys=surveys, total=total)  # type: ignore[arg-type]


@router.get(
    "/active",
    response_model=NPSSurveyResponse | None,
    dependencies=[Depends(require_internal)],
)
async def get_active_nps_survey(db: DB) -> Any:
    """Get the currently active NPS survey (if any)."""
    surveys, _ = await nps_survey_service.get_surveys(
        db,
        status=NPSSurveyStatus.active,
        limit=1,
    )
    return surveys[0] if surveys else None


@router.get(
    "/{survey_id}",
    response_model=NPSSurveyResponse,
    dependencies=[Depends(require_internal)],
)
async def get_nps_survey(
    survey_id: uuid.UUID,
    db: DB,
) -> Any:
    """Get a specific NPS survey."""
    survey = await nps_survey_service.get(db, survey_id)
    if not survey:
        raise NotFoundException("Survey not found")
    return survey


@router.patch(
    "/{survey_id}",
    response_model=NPSSurveyResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def update_nps_survey(
    survey_id: uuid.UUID,
    data: NPSSurveyUpdate,
    db: DB,
) -> Any:
    """Update an NPS survey."""
    survey = await nps_survey_service.get(db, survey_id)
    if not survey:
        raise NotFoundException("Survey not found")

    if survey.status not in [NPSSurveyStatus.draft, NPSSurveyStatus.scheduled]:
        raise BadRequestException("Cannot update survey that is active or closed")

    update_data = data.model_dump(exclude_unset=True)
    return await nps_survey_service.update(db, db_obj=survey, obj_in=update_data)


@router.post(
    "/{survey_id}/activate",
    response_model=NPSSurveyResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def activate_nps_survey(
    survey_id: uuid.UUID,
    db: DB,
) -> Any:
    """Activate an NPS survey for distribution."""
    survey = await nps_survey_service.get(db, survey_id)
    if not survey:
        raise NotFoundException("Survey not found")

    if survey.status not in [NPSSurveyStatus.draft, NPSSurveyStatus.scheduled]:
        raise BadRequestException("Survey must be in draft or scheduled status to activate")

    return await nps_survey_service.update_survey_status(db, survey, NPSSurveyStatus.active)


@router.post(
    "/{survey_id}/close",
    response_model=NPSSurveyResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def close_nps_survey(
    survey_id: uuid.UUID,
    db: DB,
) -> Any:
    """Close an NPS survey."""
    survey = await nps_survey_service.get(db, survey_id)
    if not survey:
        raise NotFoundException("Survey not found")

    if survey.status != NPSSurveyStatus.active:
        raise BadRequestException("Survey must be active to close")

    return await nps_survey_service.update_survey_status(db, survey, NPSSurveyStatus.closed)


@router.get(
    "/{survey_id}/stats",
    response_model=NPSSurveyStats,
    dependencies=[Depends(require_internal)],
)
async def get_nps_survey_stats(
    survey_id: uuid.UUID,
    db: DB,
) -> Any:
    """Get statistics for an NPS survey."""
    stats = await nps_survey_service.get_survey_stats(db, survey_id)
    if not stats:
        raise NotFoundException("Survey not found")
    return stats


@router.get(
    "/trends/analysis",
    response_model=NPSTrendAnalysis,
    dependencies=[Depends(require_internal)],
)
async def get_nps_trend_analysis(
    db: DB,
    client_profile_id: uuid.UUID | None = Query(None, description="Filter by client"),
    quarters: int = Query(4, ge=1, le=12, description="Number of quarters to analyze"),
) -> Any:
    """Get NPS trend analysis."""
    return await nps_survey_service.get_trend_analysis(
        db,
        client_profile_id=client_profile_id,
        quarters=quarters,
    )


# ==================== Response Endpoints ====================


@router.get(
    "/{survey_id}/responses",
    response_model=NPSResponseListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_nps_responses(
    survey_id: uuid.UUID,
    db: DB,
    score_category: str | None = Query(None, description="Filter by score category"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> Any:
    """List responses for an NPS survey."""
    survey = await nps_survey_service.get(db, survey_id)
    if not survey:
        raise NotFoundException("Survey not found")

    responses, total = await nps_response_service.get_responses(
        db,
        survey_id=survey_id,
        score_category=score_category,
        skip=skip,
        limit=limit,
    )
    return NPSResponseListResponse(responses=responses, total=total)  # type: ignore[arg-type]


@router.post(
    "/{survey_id}/responses",
    response_model=NPSResponseDetail,
    status_code=201,
)
async def submit_nps_response(
    survey_id: uuid.UUID,
    data: NPSResponseCreate,
    db: DB,
    current_user: CurrentUser,
) -> Any:
    """Submit an NPS response (client endpoint)."""
    survey = await nps_survey_service.get(db, survey_id)
    if not survey:
        raise NotFoundException("Survey not found")

    if survey.status != NPSSurveyStatus.active:
        raise BadRequestException("Survey is not currently active")

    # Get client profile for current user
    from app.models.client_profile import ClientProfile

    result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )
    client_profile = result.scalar_one_or_none()
    if not client_profile:
        raise ForbiddenException("Client profile not found")

    # Check for existing response
    existing = await nps_response_service.check_existing_response(
        db, survey_id, client_profile.id
    )
    if existing:
        raise BadRequestException("You have already responded to this survey")

    return await nps_response_service.submit_response(
        db,
        survey_id=survey_id,
        client_profile_id=client_profile.id,
        data=data,
    )


@router.get(
    "/{survey_id}/responses/{response_id}",
    response_model=NPSResponseDetail,
    dependencies=[Depends(require_internal)],
)
async def get_nps_response(
    survey_id: uuid.UUID,
    response_id: uuid.UUID,
    db: DB,
) -> Any:
    """Get a specific NPS response."""
    responses, _ = await nps_response_service.get_responses(
        db,
        survey_id=survey_id,
        limit=1000,
    )
    for response in responses:
        if response.id == response_id:
            return response
    raise NotFoundException("Response not found")


# ==================== Follow-Up Endpoints ====================


@router.get(
    "/{survey_id}/follow-ups",
    response_model=NPSFollowUpListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_nps_follow_ups(
    survey_id: uuid.UUID,
    db: DB,
    status: str | None = Query(None, description="Filter by status"),
    priority: str | None = Query(None, description="Filter by priority"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> Any:
    """List follow-ups for an NPS survey."""
    survey = await nps_survey_service.get(db, survey_id)
    if not survey:
        raise NotFoundException("Survey not found")

    follow_ups, total = await nps_follow_up_service.get_follow_ups(
        db,
        survey_id=survey_id,
        status=status,
        priority=priority,
        skip=skip,
        limit=limit,
    )
    return NPSFollowUpListResponse(follow_ups=follow_ups, total=total)  # type: ignore[arg-type]


@router.get(
    "/follow-ups/my",
    response_model=NPSFollowUpListResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def list_my_nps_follow_ups(
    db: DB,
    current_user: CurrentUser,
    status: str | None = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> Any:
    """List follow-ups assigned to the current user."""
    follow_ups, total = await nps_follow_up_service.get_my_follow_ups(
        db,
        user_id=current_user.id,
        status=status,
        skip=skip,
        limit=limit,
    )
    return NPSFollowUpListResponse(follow_ups=follow_ups, total=total)  # type: ignore[arg-type]


@router.get(
    "/follow-ups/{follow_up_id}",
    response_model=NPSFollowUpResponse,
    dependencies=[Depends(require_internal)],
)
async def get_nps_follow_up(
    follow_up_id: uuid.UUID,
    db: DB,
) -> Any:
    """Get a specific NPS follow-up."""
    follow_up = await nps_follow_up_service.get(db, follow_up_id)
    if not follow_up:
        raise NotFoundException("Follow-up not found")
    return follow_up


@router.patch(
    "/follow-ups/{follow_up_id}",
    response_model=NPSFollowUpResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def update_nps_follow_up(
    follow_up_id: uuid.UUID,
    data: NPSFollowUpUpdate,
    db: DB,
    current_user: CurrentUser,
) -> Any:
    """Update an NPS follow-up."""
    follow_up = await nps_follow_up_service.get(db, follow_up_id)
    if not follow_up:
        raise NotFoundException("Follow-up not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle status update
    if data.status:
        follow_up = await nps_follow_up_service.update_status(
            db,
            follow_up,
            data.status,
            resolution_notes=data.resolution_notes,
        )
        update_data.pop("status", None)
        update_data.pop("resolution_notes", None)

    # Apply other updates
    if update_data:
        follow_up = await nps_follow_up_service.update(db, db_obj=follow_up, obj_in=update_data)

    return follow_up


@router.post(
    "/follow-ups/{follow_up_id}/acknowledge",
    response_model=NPSFollowUpResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def acknowledge_nps_follow_up(
    follow_up_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> Any:
    """Acknowledge an NPS follow-up."""
    follow_up = await nps_follow_up_service.get(db, follow_up_id)
    if not follow_up:
        raise NotFoundException("Follow-up not found")

    if follow_up.status != NPSFollowUpStatus.pending:
        raise BadRequestException("Follow-up must be in pending status to acknowledge")

    return await nps_follow_up_service.update_status(db, follow_up, NPSFollowUpStatus.acknowledged)


@router.post(
    "/follow-ups/{follow_up_id}/complete",
    response_model=NPSFollowUpResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def complete_nps_follow_up(
    follow_up_id: uuid.UUID,
    resolution_notes: str | None = None,
    db: DB = None,  # type: ignore[assignment]
    current_user: CurrentUser = None,  # type: ignore[assignment]
) -> Any:
    """Complete an NPS follow-up."""
    follow_up = await nps_follow_up_service.get(db, follow_up_id)
    if not follow_up:
        raise NotFoundException("Follow-up not found")

    if follow_up.status == NPSFollowUpStatus.completed:
        raise BadRequestException("Follow-up is already completed")

    return await nps_follow_up_service.update_status(
        db,
        follow_up,
        NPSFollowUpStatus.completed,
        resolution_notes=resolution_notes,
    )
