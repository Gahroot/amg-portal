"""Communication/message management endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import DB, CurrentUser
from app.schemas.communication import (
    CommunicationCreate,
    CommunicationListResponse,
    CommunicationMarkReadRequest,
    CommunicationResponse,
    SendMessageRequest,
    UnreadCountResponse,
)
from app.services.communication_service import communication_service

router = APIRouter()


@router.post("/send", response_model=CommunicationResponse)
async def send_communication(
    data: CommunicationCreate,
    db: DB,
    current_user: CurrentUser,
):
    """Send a new communication (message)."""
    # Convert to SendMessageRequest for internal handling
    send_data = SendMessageRequest(
        conversation_id=data.conversation_id,
        body=data.body,
        attachment_ids=data.attachment_ids,
    )

    try:
        message = await communication_service.send_message(
            db, sender_id=current_user.id, data=send_data
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        ) from None

    return message


@router.get("/", response_model=CommunicationListResponse)
async def list_communications(
    db: DB,
    current_user: CurrentUser,
    conversation_id: uuid.UUID | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List communications, optionally filtered by conversation."""
    if conversation_id:
        messages, total = await communication_service.get_messages_for_conversation(
            db, conversation_id, current_user.id, skip=skip, limit=limit
        )
    else:
        # If no conversation specified, return all user's communications
        # This would need a more complex query filtering by user's conversations
        messages, total = [], 0

    return CommunicationListResponse(communications=messages, total=total)


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    db: DB,
    current_user: CurrentUser,
):
    """Get unread message count for current user."""
    counts = await communication_service.get_unread_count(db, current_user.id)
    return UnreadCountResponse(**counts)


@router.post("/mark-read", status_code=204)
async def mark_message_read(
    data: CommunicationMarkReadRequest,
    db: DB,
    current_user: CurrentUser,
):
    """Mark a specific message as read."""
    await communication_service.mark_read(db, data.communication_id, current_user.id)


@router.get("/conversations", response_model=CommunicationListResponse)
async def get_conversation_communications(
    conversation_id: uuid.UUID = Query(...),
    db: DB = Depends(),
    current_user: CurrentUser = Depends(),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Get all communications for a specific conversation."""
    messages, total = await communication_service.get_messages_for_conversation(
        db, conversation_id, current_user.id, skip=skip, limit=limit
    )

    return CommunicationListResponse(communications=messages, total=total)
