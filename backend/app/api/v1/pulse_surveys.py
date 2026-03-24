"""Pulse Survey API endpoints."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.api.deps import (
    DB,
    CurrentUser,
    require_internal,
    require_rm_or_above,
)
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.enums import PulseSurveyStatus
from app.models.pulse_survey import PulseSurvey
from app.schemas.pulse_survey import (
    PulseSurveyClientStatus,
    PulseSurveyCreate,
    PulseSurveyDetail,
    PulseSurveyListResponse,
    PulseSurveyResponseCreate,
    PulseSurveyResponseDetail,
    PulseSurveyResponseListResponse,
    PulseSurveyStats,
    PulseSurveyUpdate,
)
from app.services.pulse_survey_service import pulse_response_service, pulse_survey_service

router = APIRouter()


# ─── Helpers ─────────────────────────────────────────────────────────────────


async def _enrich(db: DB, survey: PulseSurvey) -> PulseSurveyDetail:
    """Attach response_count to a PulseSurvey ORM object for serialisation."""
    from sqlalchemy import func

    from app.models.pulse_survey import PulseSurveyResponse

    result = await db.execute(
        select(func.count()).select_from(PulseSurveyResponse).where(
            PulseSurveyResponse.survey_id == survey.id
        )
    )
    count = result.scalar_one()
    detail = PulseSurveyDetail.model_validate(survey)
    detail.response_count = count
    return detail


# ─── Admin Survey Endpoints ───────────────────────────────────────────────────


@router.post(
    "/",
    response_model=PulseSurveyDetail,
    status_code=201,
    dependencies=[Depends(require_rm_or_above)],
)
async def create_pulse_survey(
    data: PulseSurveyCreate,
    db: DB,
    current_user: CurrentUser,
) -> PulseSurveyDetail:
    """Create a new pulse survey."""
    survey = await pulse_survey_service.create_survey(
        db, data=data, created_by_id=current_user.id
    )
    return await _enrich(db, survey)


@router.get(
    "/",
    response_model=PulseSurveyListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_pulse_surveys(
    db: DB,
    status: str | None = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> PulseSurveyListResponse:
    """List pulse surveys (admin)."""
    surveys, total = await pulse_survey_service.get_surveys(
        db, status=status, skip=skip, limit=limit
    )
    items = [await _enrich(db, s) for s in surveys]
    return PulseSurveyListResponse(surveys=items, total=total)


@router.get(
    "/{survey_id}",
    response_model=PulseSurveyDetail,
    dependencies=[Depends(require_internal)],
)
async def get_pulse_survey(
    survey_id: uuid.UUID,
    db: DB,
) -> PulseSurveyDetail:
    """Get a specific pulse survey (admin)."""
    survey = await pulse_survey_service.get(db, survey_id)
    if not survey:
        raise NotFoundException("Pulse survey not found")
    return await _enrich(db, survey)


@router.patch(
    "/{survey_id}",
    response_model=PulseSurveyDetail,
    dependencies=[Depends(require_rm_or_above)],
)
async def update_pulse_survey(
    survey_id: uuid.UUID,
    data: PulseSurveyUpdate,
    db: DB,
) -> PulseSurveyDetail:
    """Update a pulse survey."""
    survey = await pulse_survey_service.get(db, survey_id)
    if not survey:
        raise NotFoundException("Pulse survey not found")
    if survey.status == PulseSurveyStatus.closed:
        raise BadRequestException("Cannot update a closed survey")

    update_data = data.model_dump(exclude_unset=True)
    survey = await pulse_survey_service.update(db, db_obj=survey, obj_in=update_data)
    return await _enrich(db, survey)


@router.post(
    "/{survey_id}/activate",
    response_model=PulseSurveyDetail,
    dependencies=[Depends(require_rm_or_above)],
)
async def activate_pulse_survey(
    survey_id: uuid.UUID,
    db: DB,
) -> PulseSurveyDetail:
    """Activate a draft pulse survey."""
    survey = await pulse_survey_service.get(db, survey_id)
    if not survey:
        raise NotFoundException("Pulse survey not found")
    if survey.status != PulseSurveyStatus.draft:
        raise BadRequestException("Survey must be in draft status to activate")
    survey = await pulse_survey_service.activate_survey(db, survey)
    return await _enrich(db, survey)


@router.post(
    "/{survey_id}/close",
    response_model=PulseSurveyDetail,
    dependencies=[Depends(require_rm_or_above)],
)
async def close_pulse_survey(
    survey_id: uuid.UUID,
    db: DB,
) -> PulseSurveyDetail:
    """Close an active pulse survey."""
    survey = await pulse_survey_service.get(db, survey_id)
    if not survey:
        raise NotFoundException("Pulse survey not found")
    if survey.status != PulseSurveyStatus.active:
        raise BadRequestException("Survey must be active to close")
    survey = await pulse_survey_service.close_survey(db, survey)
    return await _enrich(db, survey)


@router.get(
    "/{survey_id}/stats",
    response_model=PulseSurveyStats,
    dependencies=[Depends(require_internal)],
)
async def get_pulse_survey_stats(
    survey_id: uuid.UUID,
    db: DB,
) -> PulseSurveyStats:
    """Get statistics for a pulse survey."""
    survey = await pulse_survey_service.get(db, survey_id)
    if not survey:
        raise NotFoundException("Pulse survey not found")
    return await pulse_survey_service.get_stats(db, survey)


@router.get(
    "/{survey_id}/responses",
    response_model=PulseSurveyResponseListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_pulse_responses(
    survey_id: uuid.UUID,
    db: DB,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> PulseSurveyResponseListResponse:
    """List responses for a pulse survey (admin)."""
    survey = await pulse_survey_service.get(db, survey_id)
    if not survey:
        raise NotFoundException("Pulse survey not found")
    responses, total = await pulse_response_service.list_responses(
        db, survey_id=survey_id, skip=skip, limit=limit
    )
    items = [PulseSurveyResponseDetail.model_validate(r) for r in responses]
    return PulseSurveyResponseListResponse(responses=items, total=total)


# ─── Client Endpoints ────────────────────────────────────────────────────────


@router.get(
    "/active/for-me",
    response_model=PulseSurveyDetail | None,
)
async def get_active_pulse_for_client(
    db: DB,
    current_user: CurrentUser,
) -> PulseSurveyDetail | None:
    """
    Return the active pulse survey for the current client, if one exists
    and they haven't already responded (respects anti-fatigue rules).
    Returns null if no survey is pending.
    """
    from app.models.client_profile import ClientProfile

    result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )
    client_profile = result.scalar_one_or_none()
    if not client_profile:
        return None

    survey = await pulse_survey_service.get_active_for_client(db, client_profile.id)
    if not survey:
        return None
    return await _enrich(db, survey)


@router.get(
    "/{survey_id}/my-status",
    response_model=PulseSurveyClientStatus,
)
async def get_my_pulse_status(
    survey_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> PulseSurveyClientStatus:
    """Check whether the current client has responded to a specific pulse survey."""
    from app.models.client_profile import ClientProfile

    result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )
    client_profile = result.scalar_one_or_none()
    if not client_profile:
        raise ForbiddenException("Client profile not found")

    existing = await pulse_survey_service.get_client_status(db, survey_id, client_profile.id)
    return PulseSurveyClientStatus(
        survey_id=survey_id,
        has_responded=existing is not None,
        responded_at=existing.responded_at if existing else None,
    )


@router.post(
    "/{survey_id}/respond",
    response_model=PulseSurveyResponseDetail,
    status_code=201,
)
async def submit_pulse_response(
    survey_id: uuid.UUID,
    data: PulseSurveyResponseCreate,
    db: DB,
    current_user: CurrentUser,
) -> PulseSurveyResponseDetail:
    """Submit a one-click pulse survey response (client)."""
    from app.models.client_profile import ClientProfile
    from app.services.pulse_survey_service import _valid_values

    survey = await pulse_survey_service.get(db, survey_id)
    if not survey:
        raise NotFoundException("Pulse survey not found")
    if survey.status != PulseSurveyStatus.active:
        raise BadRequestException("Survey is not currently active")

    # Validate response value
    valid = _valid_values(survey.response_type)
    if data.response_value not in valid:
        raise BadRequestException(
            f"Invalid response value '{data.response_value}' for type '{survey.response_type}'. "
            f"Valid values: {sorted(valid)}"
        )

    result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )
    client_profile = result.scalar_one_or_none()
    if not client_profile:
        raise ForbiddenException("Client profile not found")

    existing = await pulse_survey_service.get_client_status(db, survey_id, client_profile.id)
    if existing:
        raise BadRequestException("You have already responded to this survey")

    response = await pulse_response_service.submit_response(
        db,
        survey=survey,
        client_profile_id=client_profile.id,
        data=data,
    )
    return PulseSurveyResponseDetail.model_validate(response)
