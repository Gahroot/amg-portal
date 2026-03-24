"""Conversation management endpoints."""

import uuid

from fastapi import APIRouter, Depends, Query

from app.api.deps import DB, CurrentUser, RLSContext, require_internal
from app.core.exceptions import ForbiddenException, NotFoundException
from app.schemas.communication import CommunicationResponse, SendMessageRequest
from app.schemas.conversation import (
    AddParticipantRequest,
    ConversationCreate,
    ConversationListResponse,
    ConversationResponse,
    ConversationUpdate,
    MessageListResponse,
)
from app.services.communication_service import communication_service
from app.services.conversation_service import MessageScopeError, conversation_service

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
    _rls: RLSContext,
):
    """Create a new conversation."""
    conversation = await conversation_service.create(db, obj_in=data, created_by_id=current_user.id)
    return conversation


@router.get("/", response_model=ConversationListResponse)
async def list_conversations(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List conversations for current user, with per-conversation unread counts."""
    conversations, total = await conversation_service.get_conversations_for_user(
        db,
        user_id=current_user.id,
        user_role=current_user.role,
        skip=skip,
        limit=limit,
    )

    # Compute unread counts for all returned conversations in one pass
    conv_ids = [c.id for c in conversations]
    unread_counts = await communication_service.get_unread_counts_for_conversations(
        db, conv_ids, current_user.id
    )

    # Build typed responses and inject the computed unread_count
    conv_responses: list[ConversationResponse] = []
    for conv in conversations:
        resp = ConversationResponse.model_validate(conv)
        resp.unread_count = unread_counts.get(str(conv.id), 0)
        conv_responses.append(resp)

    return ConversationListResponse(conversations=conv_responses, total=total)


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
):
    """Get a specific conversation."""
    conversation = await conversation_service.get(db, conversation_id)
    if not conversation:
        raise NotFoundException("Conversation not found")

    # Check access - user must be a participant
    if str(current_user.id) not in [str(pid) for pid in conversation.participant_ids]:
        raise ForbiddenException("Not a participant in this conversation")

    resp = ConversationResponse.model_validate(conversation)
    unread_counts = await communication_service.get_unread_counts_for_conversations(
        db, [conversation.id], current_user.id
    )
    resp.unread_count = unread_counts.get(str(conversation.id), 0)
    return resp


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: uuid.UUID,
    data: ConversationUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
):
    """Update conversation metadata."""
    conversation = await conversation_service.get(db, conversation_id)
    if not conversation:
        raise NotFoundException("Conversation not found")

    return await conversation_service.update(db, db_obj=conversation, obj_in=data)


@router.post("/{conversation_id}/messages", response_model=CommunicationResponse)
async def send_message(
    conversation_id: uuid.UUID,
    data: SendMessageRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
):
    """Send a message to a conversation with scope enforcement."""
    conversation = await conversation_service.get(db, conversation_id)
    if not conversation:
        raise NotFoundException("Conversation not found")

    # Enforce messaging scope rules (participant check + role-based restrictions)
    try:
        await conversation_service.validate_message_scope(db, conversation_id, current_user.id)
    except MessageScopeError as exc:
        raise ForbiddenException(exc.detail) from exc

    data.conversation_id = conversation_id
    message = await communication_service.send_message(db, sender_id=current_user.id, data=data)

    return message


@router.get("/{conversation_id}/messages", response_model=MessageListResponse)
async def get_messages(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
):
    """Get messages for a conversation, including read_receipts on each message."""
    conversation = await conversation_service.get(db, conversation_id)
    if not conversation:
        raise NotFoundException("Conversation not found")

    if str(current_user.id) not in [str(pid) for pid in conversation.participant_ids]:
        raise ForbiddenException("Not a participant in this conversation")

    messages, total = await communication_service.get_messages_for_conversation(
        db, conversation_id, current_user.id, skip=skip, limit=limit
    )

    message_responses = [CommunicationResponse.model_validate(m) for m in messages]
    return MessageListResponse(communications=message_responses, total=total)


@router.post("/{conversation_id}/mark-read", status_code=204)
async def mark_conversation_read(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
):
    """Mark all messages in a conversation as read for the current user."""
    conversation = await conversation_service.get(db, conversation_id)
    if not conversation:
        raise NotFoundException("Conversation not found")

    if str(current_user.id) not in [str(pid) for pid in conversation.participant_ids]:
        raise ForbiddenException("Not a participant in this conversation")

    await communication_service.mark_messages_read(db, conversation_id, current_user.id)


@router.post("/{conversation_id}/participants", response_model=ConversationResponse)
async def add_participant(
    conversation_id: uuid.UUID,
    data: AddParticipantRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
):
    """Add a participant to a conversation."""
    conversation = await conversation_service.add_participant(db, conversation_id, data.user_id)
    if not conversation:
        raise NotFoundException("Conversation not found")

    return conversation
