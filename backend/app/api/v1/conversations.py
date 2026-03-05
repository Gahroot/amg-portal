"""Conversation management endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import DB, CurrentUser, require_internal
from app.schemas.communication import SendMessageRequest
from app.schemas.conversation import (
    AddParticipantRequest,
    ConversationCreate,
    ConversationListResponse,
    ConversationResponse,
    ConversationUpdate,
    MessageListResponse,
)
from app.services.communication_service import communication_service
from app.services.conversation_service import conversation_service

router = APIRouter()


@router.post(
    "/",
    response_model=ConversationResponse,
    status_code=201,
    dependencies=[Depends(require_internal)],
)
async def create_conversation(
    data: ConversationCreate,
    db: DB,
    current_user: CurrentUser,
):
    """Create a new conversation."""
    conversation = await conversation_service.create(db, obj_in=data, created_by_id=current_user.id)
    return conversation


@router.get("/", response_model=ConversationListResponse)
async def list_conversations(
    db: DB,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List conversations for current user."""
    conversations, total = await conversation_service.get_conversations_for_user(
        db,
        user_id=current_user.id,
        user_role=current_user.role,
        skip=skip,
        limit=limit,
    )
    return ConversationListResponse(conversations=conversations, total=total)


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    """Get a specific conversation."""
    conversation = await conversation_service.get(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # Check access - user must be a participant
    if str(current_user.id) not in [str(pid) for pid in conversation.participant_ids]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant in this conversation"
        )

    return conversation


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: uuid.UUID,
    data: ConversationUpdate,
    db: DB,
    current_user: CurrentUser,
):
    """Update conversation metadata."""
    conversation = await conversation_service.get(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    return await conversation_service.update(db, db_obj=conversation, obj_in=data)


@router.post("/{conversation_id}/messages", response_model=dict)
async def send_message(
    conversation_id: uuid.UUID,
    data: SendMessageRequest,
    db: DB,
    current_user: CurrentUser,
):
    """Send a message to a conversation."""
    # Verify conversation exists and user has access
    conversation = await conversation_service.get(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    if str(current_user.id) not in [str(pid) for pid in conversation.participant_ids]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant in this conversation"
        )

    data.conversation_id = conversation_id
    message = await communication_service.send_message(db, sender_id=current_user.id, data=data)

    return message


@router.get("/{conversation_id}/messages", response_model=MessageListResponse)
async def get_messages(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
):
    """Get messages for a conversation."""
    conversation = await conversation_service.get(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    if str(current_user.id) not in [str(pid) for pid in conversation.participant_ids]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant in this conversation"
        )

    messages, total = await communication_service.get_messages_for_conversation(
        db, conversation_id, skip=skip, limit=limit
    )

    return MessageListResponse(messages=messages, total=total)


@router.post("/{conversation_id}/mark-read", status_code=204)
async def mark_conversation_read(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    """Mark all messages in conversation as read."""
    await conversation_service.mark_conversation_read(db, conversation_id, current_user.id)


@router.post("/{conversation_id}/participants", response_model=ConversationResponse)
async def add_participant(
    conversation_id: uuid.UUID,
    data: AddParticipantRequest,
    db: DB,
    current_user: CurrentUser,
):
    """Add a participant to a conversation."""
    conversation = await conversation_service.add_participant(db, conversation_id, data.user_id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    return conversation
