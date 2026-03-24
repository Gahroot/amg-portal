"""Communication audit trail API endpoints."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.api.deps import DB, CurrentUser, require_internal
from app.schemas.communication_audit import (
    CommunicationAuditListResponse,
    CommunicationAuditResponse,
)
from app.services.communication_audit_service import (
    get_communication_audit_trail,
    search_communication_audits,
)

router = APIRouter()


@router.get(
    "/communications/{communication_id}/audit-trail",
    response_model=CommunicationAuditListResponse,
    dependencies=[Depends(require_internal)],
)
async def get_audit_trail_for_communication(
    communication_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> CommunicationAuditListResponse:
    """Get the full audit trail for a specific communication."""
    items, total = await get_communication_audit_trail(
        db, communication_id, skip=skip, limit=limit
    )
    return CommunicationAuditListResponse(
        audits=[CommunicationAuditResponse(**item) for item in items],
        total=total,
    )


@router.get(
    "/communications",
    response_model=CommunicationAuditListResponse,
    dependencies=[Depends(require_internal)],
)
async def search_audit_trail(
    db: DB,
    current_user: CurrentUser,
    action: str | None = Query(None),
    actor_id: uuid.UUID | None = Query(None),
    communication_id: uuid.UUID | None = Query(None),
    conversation_id: uuid.UUID | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> CommunicationAuditListResponse:
    """Search and filter communication audit entries."""
    items, total = await search_communication_audits(
        db,
        action=action,
        actor_id=actor_id,
        communication_id=communication_id,
        conversation_id=conversation_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )
    return CommunicationAuditListResponse(
        audits=[CommunicationAuditResponse(**item) for item in items],
        total=total,
    )
