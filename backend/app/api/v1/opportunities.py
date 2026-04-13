"""CRM opportunity (pipeline) endpoints."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.api.deps import DB, CurrentUser, RLSContext, require_internal, require_rm_or_above
from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.enums import OpportunityStage, UserRole
from app.models.opportunity import Opportunity
from app.schemas.opportunity import (
    OpportunityCreate,
    OpportunityListResponse,
    OpportunityReorderRequest,
    OpportunityResponse,
    OpportunityUpdate,
    PipelineSummary,
)
from app.services.opportunity_service import opportunity_service

router = APIRouter()


@router.post(
    "/",
    response_model=OpportunityResponse,
    status_code=201,
    dependencies=[Depends(require_rm_or_above)],
)
async def create_opportunity(
    data: OpportunityCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    return await opportunity_service.create_for_owner(
        db, data=data, default_owner_id=current_user.id
    )


@router.get(
    "/",
    response_model=OpportunityListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_opportunities(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    stage: OpportunityStage | None = None,
    owner_id: uuid.UUID | None = None,
    lead_id: uuid.UUID | None = None,
    client_profile_id: uuid.UUID | None = None,
    search: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
) -> Any:
    filters: list[Any] = []
    if stage:
        filters.append(Opportunity.stage == stage.value)
    if lead_id:
        filters.append(Opportunity.lead_id == lead_id)
    if client_profile_id:
        filters.append(Opportunity.client_profile_id == client_profile_id)

    if current_user.role == UserRole.relationship_manager:
        filters.append(Opportunity.owner_id == current_user.id)
    elif owner_id:
        filters.append(Opportunity.owner_id == owner_id)

    if search:
        filters.append(Opportunity.title.ilike(f"%{search}%"))

    opportunities, total = await opportunity_service.get_multi(
        db,
        skip=skip,
        limit=limit,
        filters=filters,
        order_by=Opportunity.position,
    )
    return OpportunityListResponse(opportunities=opportunities, total=total)  # type: ignore[arg-type]


@router.get(
    "/pipeline-summary",
    response_model=list[PipelineSummary],
    dependencies=[Depends(require_internal)],
)
async def get_pipeline_summary(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> list[PipelineSummary]:
    owner_id = current_user.id if current_user.role == UserRole.relationship_manager else None
    return await opportunity_service.pipeline_summary(db, owner_id=owner_id)


@router.get(
    "/{opportunity_id}",
    response_model=OpportunityResponse,
    dependencies=[Depends(require_internal)],
)
async def get_opportunity(
    opportunity_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    opp = await opportunity_service.get(db, opportunity_id)
    if not opp:
        raise NotFoundException("Opportunity not found")
    if current_user.role == UserRole.relationship_manager and opp.owner_id != current_user.id:
        raise ForbiddenException("Access denied")
    return opp


@router.patch(
    "/{opportunity_id}",
    response_model=OpportunityResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def update_opportunity(
    opportunity_id: uuid.UUID,
    data: OpportunityUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    opp = await opportunity_service.get(db, opportunity_id)
    if not opp:
        raise NotFoundException("Opportunity not found")
    if current_user.role == UserRole.relationship_manager and opp.owner_id != current_user.id:
        raise ForbiddenException("Access denied")
    return await opportunity_service.update_with_stage_side_effects(db, db_obj=opp, obj_in=data)


@router.post(
    "/{opportunity_id}/reorder",
    response_model=OpportunityResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def reorder_opportunity(
    opportunity_id: uuid.UUID,
    request: OpportunityReorderRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    opp = await opportunity_service.get(db, opportunity_id)
    if not opp:
        raise NotFoundException("Opportunity not found")
    if current_user.role == UserRole.relationship_manager and opp.owner_id != current_user.id:
        raise ForbiddenException("Access denied")
    return await opportunity_service.reorder(db, opportunity_id=opportunity_id, request=request)


@router.delete(
    "/{opportunity_id}",
    status_code=204,
    dependencies=[Depends(require_rm_or_above)],
)
async def delete_opportunity(
    opportunity_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> None:
    opp = await opportunity_service.get(db, opportunity_id)
    if not opp:
        raise NotFoundException("Opportunity not found")
    if current_user.role == UserRole.relationship_manager and opp.owner_id != current_user.id:
        raise ForbiddenException("Access denied")
    await opportunity_service.delete(db, id=opportunity_id)
