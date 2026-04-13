"""CRM lead management endpoints."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.api.deps import DB, CurrentUser, RLSContext, require_internal, require_rm_or_above
from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.enums import LeadSource, LeadStatus, UserRole
from app.models.lead import Lead
from app.schemas.lead import (
    LeadConvertRequest,
    LeadCreate,
    LeadListResponse,
    LeadResponse,
    LeadUpdate,
)
from app.services.lead_service import lead_service

router = APIRouter()


@router.post(
    "/",
    response_model=LeadResponse,
    status_code=201,
    dependencies=[Depends(require_rm_or_above)],
)
async def create_lead(
    data: LeadCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    return await lead_service.create_for_owner(db, data=data, default_owner_id=current_user.id)


@router.get(
    "/",
    response_model=LeadListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_leads(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    status: LeadStatus | None = None,
    source: LeadSource | None = None,
    owner_id: uuid.UUID | None = None,
    search: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> Any:
    filters: list[Any] = []
    if status:
        filters.append(Lead.status == status.value)
    if source:
        filters.append(Lead.source == source.value)

    if current_user.role == UserRole.relationship_manager:
        filters.append(Lead.owner_id == current_user.id)
    elif owner_id:
        filters.append(Lead.owner_id == owner_id)

    if search:
        pattern = f"%{search}%"
        filters.append(Lead.full_name.ilike(pattern) | Lead.email.ilike(pattern))

    leads, total = await lead_service.get_multi(db, skip=skip, limit=limit, filters=filters)
    return LeadListResponse(leads=leads, total=total)  # type: ignore[arg-type]


@router.get(
    "/{lead_id}",
    response_model=LeadResponse,
    dependencies=[Depends(require_internal)],
)
async def get_lead(
    lead_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    lead = await lead_service.get(db, lead_id)
    if not lead:
        raise NotFoundException("Lead not found")
    if current_user.role == UserRole.relationship_manager and lead.owner_id != current_user.id:
        raise ForbiddenException("Access denied: lead not in your portfolio")
    return lead


@router.patch(
    "/{lead_id}",
    response_model=LeadResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def update_lead(
    lead_id: uuid.UUID,
    data: LeadUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    lead = await lead_service.get(db, lead_id)
    if not lead:
        raise NotFoundException("Lead not found")
    if current_user.role == UserRole.relationship_manager and lead.owner_id != current_user.id:
        raise ForbiddenException("Access denied: lead not in your portfolio")
    return await lead_service.update(db, db_obj=lead, obj_in=data)


@router.delete(
    "/{lead_id}",
    status_code=204,
    dependencies=[Depends(require_rm_or_above)],
)
async def delete_lead(
    lead_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> None:
    lead = await lead_service.get(db, lead_id)
    if not lead:
        raise NotFoundException("Lead not found")
    if current_user.role == UserRole.relationship_manager and lead.owner_id != current_user.id:
        raise ForbiddenException("Access denied: lead not in your portfolio")
    await lead_service.delete(db, id=lead_id)


@router.post(
    "/{lead_id}/convert",
    response_model=LeadResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def convert_lead(
    lead_id: uuid.UUID,
    data: LeadConvertRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    return await lead_service.convert_to_client(
        db, lead_id=lead_id, convert=data, created_by_id=current_user.id
    )
