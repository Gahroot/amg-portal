"""Communication logs API — audit trail for external communications."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import Select, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, RLSContext, require_internal
from app.core.exceptions import NotFoundException
from app.models.communication_log import CommunicationLog
from app.schemas.communication_log import (
    CommunicationLogCreate,
    CommunicationLogListResponse,
    CommunicationLogResponse,
    CommunicationLogUpdate,
)
from app.services.crud_base import paginate

router = APIRouter()


def _build_response(log: CommunicationLog) -> CommunicationLogResponse:
    return CommunicationLogResponse(
        id=log.id,
        channel=log.channel,
        direction=log.direction,
        subject=log.subject,
        summary=log.summary,
        client_id=log.client_id,
        partner_id=log.partner_id,
        program_id=log.program_id,
        logged_by=log.logged_by,
        contact_name=log.contact_name,
        contact_email=log.contact_email,
        occurred_at=log.occurred_at,
        attachments=log.attachments,
        tags=log.tags,
        created_at=log.created_at,
        updated_at=log.updated_at,
        client_name=(log.client.legal_name if log.client else None),
        partner_name=(log.partner.firm_name if log.partner else None),
        program_title=(log.program.title if log.program else None),
        logger_name=(log.logger.full_name if log.logger else None),
    )


def _base_query() -> Select[tuple[CommunicationLog]]:
    return select(CommunicationLog).options(
        selectinload(CommunicationLog.client),
        selectinload(CommunicationLog.partner),
        selectinload(CommunicationLog.program),
        selectinload(CommunicationLog.logger),
    )


@router.post(
    "/",
    response_model=CommunicationLogResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_internal)],
)
async def create_communication_log(
    payload: CommunicationLogCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> CommunicationLogResponse:
    """Create a new communication log entry."""
    log = CommunicationLog(
        **payload.model_dump(),
        logged_by=current_user.id,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)

    result = await db.execute(_base_query().where(CommunicationLog.id == log.id))
    log = result.scalar_one()
    return _build_response(log)


@router.get(
    "/",
    response_model=CommunicationLogListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_communication_logs(
    db: DB,
    _rls: RLSContext,
    client_id: uuid.UUID | None = Query(None),
    partner_id: uuid.UUID | None = Query(None),
    program_id: uuid.UUID | None = Query(None),
    channel: str | None = Query(None),
    direction: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    search: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> CommunicationLogListResponse:
    """List communication logs with optional filters."""
    query = _base_query()

    if client_id:
        query = query.where(CommunicationLog.client_id == client_id)
    if partner_id:
        query = query.where(CommunicationLog.partner_id == partner_id)
    if program_id:
        query = query.where(CommunicationLog.program_id == program_id)
    if channel:
        query = query.where(CommunicationLog.channel == channel)
    if direction:
        query = query.where(CommunicationLog.direction == direction)
    if date_from:
        query = query.where(CommunicationLog.occurred_at >= date_from)
    if date_to:
        query = query.where(CommunicationLog.occurred_at <= date_to)
    if search:
        query = query.where(
            CommunicationLog.subject.ilike(f"%{search}%")
            | CommunicationLog.contact_name.ilike(f"%{search}%")
        )

    query = query.order_by(CommunicationLog.occurred_at.desc())
    logs, total = await paginate(db, query, skip=skip, limit=limit)

    return CommunicationLogListResponse(
        logs=[_build_response(log) for log in logs],
        total=total,
    )


@router.get(
    "/{log_id}",
    response_model=CommunicationLogResponse,
    dependencies=[Depends(require_internal)],
)
async def get_communication_log(
    log_id: uuid.UUID,
    db: DB,
    _rls: RLSContext,
) -> CommunicationLogResponse:
    """Get a single communication log entry."""
    result = await db.execute(_base_query().where(CommunicationLog.id == log_id))
    log = result.scalar_one_or_none()
    if not log:
        raise NotFoundException("Communication log not found")
    return _build_response(log)


@router.put(
    "/{log_id}",
    response_model=CommunicationLogResponse,
    dependencies=[Depends(require_internal)],
)
async def update_communication_log(
    log_id: uuid.UUID,
    payload: CommunicationLogUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> CommunicationLogResponse:
    """Update a communication log entry."""
    result = await db.execute(_base_query().where(CommunicationLog.id == log_id))
    log = result.scalar_one_or_none()
    if not log:
        raise NotFoundException("Communication log not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(log, field, value)

    await db.commit()
    await db.refresh(log)

    result = await db.execute(_base_query().where(CommunicationLog.id == log.id))
    log = result.scalar_one()
    return _build_response(log)


@router.delete(
    "/{log_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_internal)],
)
async def delete_communication_log(
    log_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> None:
    """Delete a communication log entry."""
    result = await db.execute(select(CommunicationLog).where(CommunicationLog.id == log_id))
    log = result.scalar_one_or_none()
    if not log:
        raise NotFoundException("Communication log not found")

    await db.delete(log)
    await db.commit()
