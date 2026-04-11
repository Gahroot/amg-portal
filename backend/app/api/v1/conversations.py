"""Conversation management endpoints."""
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DB, CurrentUser, RLSContext, require_internal
from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.conversation import Conversation
from app.models.user import User
from app.schemas.communication import CommunicationResponse, SendMessageRequest
from app.schemas.conversation import (
    AddParticipantRequest,
    ConversationCreate,
    ConversationListResponse,
    ConversationResponse,
    ConversationUpdate,
    MessageListResponse,
    ParticipantInfo,
)
from app.services.communication_service import communication_service
from app.services.conversation_service import MessageScopeError, conversation_service

router = APIRouter()


async def _resolve_participants(
    db: AsyncSession, conversations: list[Conversation],
) -> dict[str, list[ParticipantInfo]]:
    """Resolve participant_ids to ParticipantInfo for a batch of conversations."""
    all_ids: set[uuid.UUID] = set()
    for conv in conversations:
        all_ids.update(conv.participant_ids)
    if not all_ids:
        return {}

    result = await db.execute(
        select(User.id, User.full_name, User.role).where(User.id.in_(all_ids))
    )
    user_map: dict[uuid.UUID, ParticipantInfo] = {}
    for row in result.all():
        user_map[row.id] = ParticipantInfo(
            id=row.id, full_name=row.full_name, role=row.role,
        )

    out: dict[str, list[ParticipantInfo]] = {}
    for conv in conversations:
        out[str(conv.id)] = [
            user_map[pid] for pid in conv.participant_ids if pid in user_map
        ]
    return out


async def _build_response(
    db: AsyncSession,
    conv: Conversation,
    current_user_id: uuid.UUID,
    participants_map: dict[str, list[ParticipantInfo]] | None = None,
) -> ConversationResponse:
    """Build a ConversationResponse with participants and unread count."""
    resp = ConversationResponse.model_validate(conv)
    # Participants
    if participants_map and str(conv.id) in participants_map:
        resp.participants = participants_map[str(conv.id)]
    else:
        resolved = await _resolve_participants(db, [conv])
        resp.participants = resolved.get(str(conv.id), [])
    # Unread count
    unread_counts = await communication_service.get_unread_counts_for_conversations(
        db, [conv.id], current_user_id,
    )
    resp.unread_count = unread_counts.get(str(conv.id), 0)
    return resp


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
) -> Any:
    """Create a new conversation."""
    # Ensure the creator is included as a participant
    if current_user.id not in data.participant_ids:
        data.participant_ids.append(current_user.id)
    conversation = await conversation_service.create(db, obj_in=data)
    return await _build_response(db, conversation, current_user.id)


@router.get("/", response_model=ConversationListResponse)
async def list_conversations(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> Any:
    """List conversations for current user, with per-conversation unread counts."""
    conversations, total = await conversation_service.get_conversations_for_user(
        db,
        user_id=current_user.id,
        user_role=current_user.role,
        skip=skip,
        limit=limit,
    )

    # Resolve participants for all conversations in one batch
    participants_map = await _resolve_participants(db, conversations)

    # Compute unread counts for all returned conversations in one pass
    conv_ids = [c.id for c in conversations]
    unread_counts = await communication_service.get_unread_counts_for_conversations(
        db, conv_ids, current_user.id
    )

    # Build typed responses and inject the computed unread_count + participants
    conv_responses: list[ConversationResponse] = []
    for conv in conversations:
        resp = ConversationResponse.model_validate(conv)
        resp.unread_count = unread_counts.get(str(conv.id), 0)
        resp.participants = participants_map.get(str(conv.id), [])
        conv_responses.append(resp)

    return ConversationListResponse(conversations=conv_responses, total=total)


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    """Get a specific conversation."""
    conversation = await conversation_service.get(db, conversation_id)
    if not conversation:
        raise NotFoundException("Conversation not found")

    # Check access - user must be a participant
    if str(current_user.id) not in [str(pid) for pid in conversation.participant_ids]:
        raise ForbiddenException("Not a participant in this conversation")

    return await _build_response(db, conversation, current_user.id)


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: uuid.UUID,
    data: ConversationUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
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
) -> Any:
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
) -> Any:
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


@router.post("/{conversation_id}/mark-read", status_code=204, response_model=None)
async def mark_conversation_read(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> None:
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
) -> Any:
    """Add a participant to a conversation."""
    conversation = await conversation_service.add_participant(db, conversation_id, data.user_id)
    if not conversation:
        raise NotFoundException("Conversation not found")

    return conversation
