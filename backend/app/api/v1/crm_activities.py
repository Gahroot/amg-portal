"""CRM activity timeline endpoints."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.api.deps import DB, CurrentUser, RLSContext, require_internal, require_rm_or_above
from app.core.exceptions import NotFoundException
from app.models.crm_activity import CrmActivity
from app.schemas.crm_activity import (
    CrmActivityCreate,
    CrmActivityListResponse,
    CrmActivityResponse,
    CrmActivityUpdate,
)
from app.services.crm_activity_service import crm_activity_service

router = APIRouter()


@router.post(
    "/",
    response_model=CrmActivityResponse,
    status_code=201,
    dependencies=[Depends(require_rm_or_above)],
)
async def create_activity(
    data: CrmActivityCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    return await crm_activity_service.create_for_user(db, data=data, created_by_id=current_user.id)


@router.get(
    "/",
    response_model=CrmActivityListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_activities(
    db: DB,
    _current_user: CurrentUser,
    _rls: RLSContext,
    lead_id: uuid.UUID | None = None,
    opportunity_id: uuid.UUID | None = None,
    client_profile_id: uuid.UUID | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> Any:
    filters: list[Any] = []
    if lead_id:
        filters.append(CrmActivity.lead_id == lead_id)
    if opportunity_id:
        filters.append(CrmActivity.opportunity_id == opportunity_id)
    if client_profile_id:
        filters.append(CrmActivity.client_profile_id == client_profile_id)

    activities, total = await crm_activity_service.get_multi(
        db,
        skip=skip,
        limit=limit,
        filters=filters,
        order_by=CrmActivity.occurred_at.desc(),
    )
    return CrmActivityListResponse(activities=activities, total=total)  # type: ignore[arg-type]


@router.patch(
    "/{activity_id}",
    response_model=CrmActivityResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def update_activity(
    activity_id: uuid.UUID,
    data: CrmActivityUpdate,
    db: DB,
    _current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    activity = await crm_activity_service.get(db, activity_id)
    if not activity:
        raise NotFoundException("Activity not found")
    return await crm_activity_service.update(db, db_obj=activity, obj_in=data)


@router.delete(
    "/{activity_id}",
    status_code=204,
    dependencies=[Depends(require_rm_or_above)],
)
async def delete_activity(
    activity_id: uuid.UUID,
    db: DB,
    _current_user: CurrentUser,
    _rls: RLSContext,
) -> None:
    activity = await crm_activity_service.get(db, activity_id)
    if not activity:
        raise NotFoundException("Activity not found")
    await crm_activity_service.delete(db, id=activity_id)
