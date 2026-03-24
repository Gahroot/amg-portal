"""Audit log endpoints — read-only, compliance-gated."""

import csv
import io
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import Select, func, select

from app.api.deps import DB, require_compliance
from app.core.exceptions import NotFoundException
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogListResponse, AuditLogResponse

router = APIRouter()


def _build_query(
    entity_type: str | None = None,
    action: str | None = None,
    user_id: UUID | None = None,
    entity_id: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    search: str | None = None,
) -> Select[tuple[AuditLog]]:
    q = select(AuditLog)
    if entity_type:
        q = q.where(AuditLog.entity_type == entity_type)
    if action:
        q = q.where(AuditLog.action == action)
    if user_id:
        q = q.where(AuditLog.user_id == user_id)
    if entity_id:
        q = q.where(AuditLog.entity_id == entity_id)
    if start_date:
        q = q.where(AuditLog.created_at >= start_date)
    if end_date:
        q = q.where(AuditLog.created_at <= end_date)
    if search:
        pattern = f"%{search}%"
        q = q.where(
            AuditLog.user_email.ilike(pattern)
            | AuditLog.entity_type.ilike(pattern)
            | AuditLog.entity_id.ilike(pattern)
        )
    return q


@router.get("/", response_model=AuditLogListResponse, dependencies=[Depends(require_compliance)])
async def list_audit_logs(
    db: DB,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    entity_type: str | None = None,
    action: str | None = None,
    user_id: UUID | None = None,
    entity_id: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    search: str | None = None,
) -> AuditLogListResponse:
    base = _build_query(entity_type, action, user_id, entity_id, start_date, end_date, search)

    count_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_result.scalar_one()

    result = await db.execute(base.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit))
    logs = result.scalars().all()

    return AuditLogListResponse(logs=list(logs), total=total)  # type: ignore[arg-type]


@router.get("/export", dependencies=[Depends(require_compliance)])
async def export_audit_logs_csv(
    db: DB,
    entity_type: str | None = None,
    action: str | None = None,
    user_id: UUID | None = None,
    entity_id: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    search: str | None = None,
) -> StreamingResponse:
    base = _build_query(entity_type, action, user_id, entity_id, start_date, end_date, search)
    result = await db.execute(base.order_by(AuditLog.created_at.desc()))
    logs = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "created_at",
            "user_email",
            "action",
            "entity_type",
            "entity_id",
            "ip_address",
        ]
    )
    for log in logs:
        writer.writerow(
            [
                str(log.id),
                log.created_at.isoformat(),
                log.user_email or "",
                log.action,
                log.entity_type,
                log.entity_id,
                log.ip_address or "",
            ]
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_logs.csv"},
    )


@router.get(
    "/{log_id}",
    response_model=AuditLogResponse,
    dependencies=[Depends(require_compliance)],
)
async def get_audit_log(log_id: UUID, db: DB) -> AuditLog:
    result = await db.execute(select(AuditLog).where(AuditLog.id == log_id))
    log = result.scalar_one_or_none()
    if not log:
        raise NotFoundException("Audit log not found")
    return log


@router.get(
    "/entity/{entity_type}/{entity_id}",
    response_model=AuditLogListResponse,
    dependencies=[Depends(require_compliance)],
)
async def get_entity_history(
    entity_type: str,
    entity_id: str,
    db: DB,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> AuditLogListResponse:
    base = select(AuditLog).where(
        AuditLog.entity_type == entity_type,
        AuditLog.entity_id == entity_id,
    )

    count_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_result.scalar_one()

    result = await db.execute(base.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit))
    logs = result.scalars().all()

    return AuditLogListResponse(logs=list(logs), total=total)  # type: ignore[arg-type]
