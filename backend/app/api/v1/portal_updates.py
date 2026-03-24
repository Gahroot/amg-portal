"""Client portal 'What's New' feed endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import DB, CurrentUser, RLSContext, require_client
from app.services import client_updates_service

router = APIRouter()


class FeedItemResponse(BaseModel):
    id: str
    update_type: str
    title: str
    description: str
    program_id: str | None
    program_title: str | None
    timestamp: str
    link: str
    is_read: bool


class FeedResponse(BaseModel):
    items: list[FeedItemResponse]
    total: int
    unread_count: int
    skip: int
    limit: int


@router.get(
    "/updates",
    response_model=FeedResponse,
    dependencies=[Depends(require_client)],
    summary="What's New feed",
    description=(
        "Returns a reverse-chronological feed of recent updates across all programs. "
        "Update types: program_status, milestone_completed, document_delivered, "
        "message_received, decision_resolved."
    ),
)
async def get_updates(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    update_type: str | None = Query(
        None,
        description=(
            "Filter by update type. One of: program_status, milestone_completed, "
            "document_delivered, message_received, decision_resolved."
        ),
    ),
    program_id: uuid.UUID | None = Query(None, description="Filter by program ID."),
    date_from: datetime | None = Query(
        None, description="Filter updates from this date (ISO 8601)."
    ),
    date_to: datetime | None = Query(
        None, description="Filter updates up to this date (ISO 8601)."
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> FeedResponse:
    """Return What's New feed for the authenticated client."""
    items, total, unread_count = await client_updates_service.get_updates(
        db,
        user_id=current_user.id,
        update_type=update_type,
        program_id=program_id,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )
    return FeedResponse(
        items=[FeedItemResponse(**item) for item in items],
        total=total,
        unread_count=unread_count,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/updates/unread-count",
    dependencies=[Depends(require_client)],
    summary="Unread updates count",
)
async def get_unread_count(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> dict[str, int]:
    """Return the number of unread What's New items for the authenticated client."""
    count = await client_updates_service.get_unread_count(db, user_id=current_user.id)
    return {"unread_count": count}


@router.post(
    "/updates/mark-all-read",
    status_code=204,
    dependencies=[Depends(require_client)],
    summary="Mark all updates as read",
)
async def mark_all_read(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> None:
    """Mark all What's New items as read for the authenticated client."""
    await client_updates_service.mark_all_read(db, user_id=current_user.id)
