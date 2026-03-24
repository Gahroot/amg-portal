"""Support chat API endpoints."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from app.api.deps import DB, CurrentUser, RLSContext, require_internal
from app.api.ws_connection import connection_manager
from app.core.exceptions import NotFoundException
from app.schemas.support_chat import (
    AgentStatusResponse,
    AgentStatusUpdate,
    AssignConversationRequest,
    OfflineMessageCreate,
    OfflineMessageResponse,
    SatisfactionSurveySubmit,
    SupportAvailabilityResponse,
    SupportConversationCreate,
    SupportConversationListResponse,
    SupportConversationResponse,
    SupportMessageCreate,
    SupportMessageListResponse,
    SupportMessageResponse,
)
from app.services.support_chat_service import support_chat_service

router = APIRouter()


def _conversation_to_response(
    conv: Any, unread_count: int = 0, user_name: str | None = None
) -> dict[str, Any]:
    """Convert a conversation to a response dict."""
    data = {
        "id": conv.id,
        "user_id": conv.user_id,
        "status": conv.status,
        "priority": conv.priority,
        "subject": conv.subject,
        "assigned_agent_id": conv.assigned_agent_id,
        "last_message_at": conv.last_message_at,
        "last_message_preview": conv.last_message_preview,
        "closed_at": conv.closed_at,
        "closed_by": conv.closed_by,
        "satisfaction_rating": conv.satisfaction_rating,
        "satisfaction_comment": conv.satisfaction_comment,
        "created_at": conv.created_at,
        "updated_at": conv.updated_at,
        "unread_count": unread_count,
        "assigned_agent_name": user_name,
    }
    return data


def _message_to_response(msg: Any, sender_name: str | None = None) -> dict[str, Any]:
    """Convert a message to a response dict."""
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "sender_type": msg.sender_type,
        "body": msg.body,
        "attachment_ids": msg.attachment_ids,
        "is_internal": msg.is_internal,
        "read_at": msg.read_at,
        "read_by_user_at": msg.read_by_user_at,
        "read_by_agent_at": msg.read_by_agent_at,
        "created_at": msg.created_at,
        "updated_at": msg.updated_at,
        "sender_name": sender_name,
    }


# ============== User Endpoints ==============


@router.get("/availability", response_model=SupportAvailabilityResponse)
async def get_support_availability(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> SupportAvailabilityResponse:
    """Get support availability status."""
    availability = await support_chat_service.get_availability(db)
    return SupportAvailabilityResponse(**availability)


@router.post("/conversations", response_model=SupportConversationResponse, status_code=201)
async def create_support_conversation(
    data: SupportConversationCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> SupportConversationResponse:
    """Start a new support conversation or get existing open one."""
    conversation = await support_chat_service.get_or_create_conversation(
        db, current_user.id, data
    )

    unread_count = await support_chat_service.get_unread_count(
        db, conversation.id, "user"
    )

    return SupportConversationResponse(
        **_conversation_to_response(conversation, unread_count=unread_count)
    )


@router.get("/conversations", response_model=SupportConversationListResponse)
async def list_user_conversations(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> SupportConversationListResponse:
    """List user's support conversations."""
    conversations, total = await support_chat_service.get_user_conversations(
        db, current_user.id, status=status, skip=skip, limit=limit
    )

    conv_responses = []
    for conv in conversations:
        unread_count = await support_chat_service.get_unread_count(db, conv.id, "user")
        conv_responses.append(
            SupportConversationResponse(
                **_conversation_to_response(conv, unread_count=unread_count)
            )
        )

    return SupportConversationListResponse(conversations=conv_responses, total=total)


@router.get("/conversations/{conversation_id}", response_model=SupportConversationResponse)
async def get_user_conversation(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> SupportConversationResponse:
    """Get a specific support conversation."""
    conversation = await support_chat_service.get_conversation(
        db, conversation_id, user_id=current_user.id
    )
    if not conversation:
        raise NotFoundException("Conversation not found")

    unread_count = await support_chat_service.get_unread_count(
        db, conversation_id, "user"
    )

    return SupportConversationResponse(
        **_conversation_to_response(conversation, unread_count=unread_count)
    )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=SupportMessageListResponse,
)
async def get_conversation_messages(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
) -> SupportMessageListResponse:
    """Get messages for a conversation."""
    # Verify access
    conversation = await support_chat_service.get_conversation(
        db, conversation_id, user_id=current_user.id
    )
    if not conversation:
        raise NotFoundException("Conversation not found")

    messages, total = await support_chat_service.get_messages(
        db, conversation_id, user_type="user", skip=skip, limit=limit
    )

    # Mark messages as read
    await support_chat_service.mark_messages_read(db, conversation_id, "user")

    message_responses = [
        SupportMessageResponse(
            **_message_to_response(msg, sender_name=msg.sender.full_name if msg.sender else None)
        )
        for msg in messages
    ]

    return SupportMessageListResponse(messages=message_responses, total=total)


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=SupportMessageResponse,
    status_code=201,
)
async def send_conversation_message(
    conversation_id: uuid.UUID,
    data: SupportMessageCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> SupportMessageResponse:
    """Send a message in a support conversation."""
    # Verify access
    conversation = await support_chat_service.get_conversation(
        db, conversation_id, user_id=current_user.id
    )
    if not conversation:
        raise NotFoundException("Conversation not found")

    message = await support_chat_service.send_message(
        db,
        conversation_id,
        current_user.id,
        "user",
        data,
    )

    response = SupportMessageResponse(
        **_message_to_response(message, sender_name=current_user.full_name)
    )

    # Broadcast new message via WebSocket
    await connection_manager.send_personal(
        {
            "type": "support_message",
            "data": {
                "conversation_id": str(conversation_id),
                "message": response.model_dump(),
            },
        },
        current_user.id,
    )

    # Also notify assigned agent if any
    if conversation.assigned_agent_id:
        await connection_manager.send_personal(
            {
                "type": "support_message",
                "data": {
                    "conversation_id": str(conversation_id),
                    "message": response.model_dump(),
                },
            },
            conversation.assigned_agent_id,
        )

    return response


@router.post("/conversations/{conversation_id}/read", status_code=204)
async def mark_conversation_read(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> JSONResponse:
    """Mark all messages in a conversation as read."""
    # Verify access
    conversation = await support_chat_service.get_conversation(
        db, conversation_id, user_id=current_user.id
    )
    if not conversation:
        raise NotFoundException("Conversation not found")

    await support_chat_service.mark_messages_read(db, conversation_id, "user")
    return JSONResponse(status_code=204, content={})


@router.post("/conversations/{conversation_id}/close", status_code=204)
async def close_user_conversation(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> JSONResponse:
    """Close a support conversation (user-initiated)."""
    # Verify access
    conversation = await support_chat_service.get_conversation(
        db, conversation_id, user_id=current_user.id
    )
    if not conversation:
        raise NotFoundException("Conversation not found")

    await support_chat_service.close_conversation(db, conversation_id, current_user.id)
    return JSONResponse(status_code=204, content={})


@router.post("/satisfaction", status_code=204)
async def submit_satisfaction_survey(
    data: SatisfactionSurveySubmit,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> JSONResponse:
    """Submit satisfaction survey for a closed conversation."""
    # Verify access
    conversation = await support_chat_service.get_conversation(
        db, data.conversation_id, user_id=current_user.id
    )
    if not conversation:
        raise NotFoundException("Conversation not found")

    await support_chat_service.submit_satisfaction(
        db, data.conversation_id, data.rating, data.comment
    )
    return JSONResponse(status_code=204, content={})


@router.post("/offline", response_model=OfflineMessageResponse, status_code=201)
async def create_offline_message(
    data: OfflineMessageCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> OfflineMessageResponse:
    """Leave a message when support is offline."""
    message = await support_chat_service.create_offline_message(
        db, current_user.id, data
    )
    return OfflineMessageResponse.model_validate(message)


# ============== Agent Endpoints (Internal Users Only) ==============


@router.get(
    "/agent/conversations",
    response_model=SupportConversationListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_agent_conversations(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> SupportConversationListResponse:
    """List support conversations for agent (assigned or unassigned)."""
    conversations, total = await support_chat_service.get_agent_conversations(
        db, current_user.id, status=status, skip=skip, limit=limit
    )

    conv_responses = []
    for conv in conversations:
        unread_count = await support_chat_service.get_unread_count(db, conv.id, "agent")
        user_name = conv.user.full_name if conv.user else None
        conv_responses.append(
            SupportConversationResponse(
                **_conversation_to_response(conv, unread_count=unread_count, user_name=user_name)
            )
        )

    return SupportConversationListResponse(conversations=conv_responses, total=total)


@router.post(
    "/agent/conversations/{conversation_id}/assign",
    response_model=SupportConversationResponse,
    dependencies=[Depends(require_internal)],
)
async def assign_conversation_to_agent(
    conversation_id: uuid.UUID,
    data: AssignConversationRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> SupportConversationResponse:
    """Assign a conversation to an agent."""
    conversation = await support_chat_service.assign_agent(
        db, conversation_id, data.agent_id
    )

    return SupportConversationResponse(**_conversation_to_response(conversation))


@router.post(
    "/agent/conversations/{conversation_id}/messages",
    response_model=SupportMessageResponse,
    status_code=201,
    dependencies=[Depends(require_internal)],
)
async def send_agent_message(
    conversation_id: uuid.UUID,
    data: SupportMessageCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    is_internal: bool = Query(False, description="Mark as internal note"),
) -> SupportMessageResponse:
    """Send a message as an agent."""
    conversation = await support_chat_service.get_conversation(db, conversation_id)
    if not conversation:
        raise NotFoundException("Conversation not found")

    # Auto-assign if not assigned
    if not conversation.assigned_agent_id:
        await support_chat_service.assign_agent(db, conversation_id, current_user.id)
        conversation = await support_chat_service.get_conversation(db, conversation_id)
        if not conversation:
            raise NotFoundException("Conversation not found after assignment")

    message = await support_chat_service.send_message(
        db,
        conversation_id,
        current_user.id,
        "agent",
        data,
        is_internal=is_internal,
    )

    response = SupportMessageResponse(
        **_message_to_response(message, sender_name=current_user.full_name)
    )

    # Notify user via WebSocket
    await connection_manager.send_personal(
        {
            "type": "support_message",
            "data": {
                "conversation_id": str(conversation_id),
                "message": response.model_dump(),
            },
        },
        conversation.user_id,
    )

    return response


@router.get(
    "/agent/conversations/{conversation_id}/messages",
    response_model=SupportMessageListResponse,
    dependencies=[Depends(require_internal)],
)
async def get_agent_conversation_messages(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
) -> SupportMessageListResponse:
    """Get messages for a conversation (agent view, includes internal notes)."""
    conversation = await support_chat_service.get_conversation(db, conversation_id)
    if not conversation:
        raise NotFoundException("Conversation not found")

    messages, total = await support_chat_service.get_messages(
        db, conversation_id, user_type="agent", skip=skip, limit=limit
    )

    # Mark messages as read by agent
    await support_chat_service.mark_messages_read(db, conversation_id, "agent")

    message_responses = [
        SupportMessageResponse(
            **_message_to_response(msg, sender_name=msg.sender.full_name if msg.sender else None)
        )
        for msg in messages
    ]

    return SupportMessageListResponse(messages=message_responses, total=total)


@router.post(
    "/agent/conversations/{conversation_id}/close",
    status_code=204,
    dependencies=[Depends(require_internal)],
)
async def close_agent_conversation(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> JSONResponse:
    """Close a support conversation (agent-initiated)."""
    conversation = await support_chat_service.get_conversation(db, conversation_id)
    if not conversation:
        raise NotFoundException("Conversation not found")

    await support_chat_service.close_conversation(db, conversation_id, current_user.id)
    return JSONResponse(status_code=204, content={})


@router.get(
    "/agent/offline-messages",
    response_model=list[OfflineMessageResponse],
    dependencies=[Depends(require_internal)],
)
async def list_offline_messages(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    processed: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> list[OfflineMessageResponse]:
    """List offline messages for agents to process."""
    messages, _ = await support_chat_service.get_offline_messages(
        db, processed=processed, skip=skip, limit=limit
    )
    return [OfflineMessageResponse.model_validate(m) for m in messages]


@router.get(
    "/agent/status",
    response_model=AgentStatusResponse,
    dependencies=[Depends(require_internal)],
)
async def get_own_agent_status(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> AgentStatusResponse:
    """Get current agent's status."""
    status = await support_chat_service.get_agent_status(db, current_user.id)
    if not status:
        return AgentStatusResponse(
            user_id=current_user.id,
            user_name=current_user.full_name,
            is_online=False,
            status="offline",
            active_conversations=0,
            max_conversations=5,
            last_seen_at=None,
        )

    return AgentStatusResponse(
        user_id=status.user_id,
        user_name=current_user.full_name,
        is_online=status.is_online,
        status=status.status,
        active_conversations=status.active_conversations,
        max_conversations=status.max_conversations,
        last_seen_at=status.last_seen_at,
    )


@router.put(
    "/agent/status",
    response_model=AgentStatusResponse,
    dependencies=[Depends(require_internal)],
)
async def update_own_agent_status(
    data: AgentStatusUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> AgentStatusResponse:
    """Update current agent's online status."""
    status = await support_chat_service.update_agent_status(db, current_user.id, data)

    return AgentStatusResponse(
        user_id=status.user_id,
        user_name=current_user.full_name,
        is_online=status.is_online,
        status=status.status,
        active_conversations=status.active_conversations,
        max_conversations=status.max_conversations,
        last_seen_at=status.last_seen_at,
    )
