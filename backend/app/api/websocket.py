"""WebSocket endpoint for real-time communications."""

import json
import uuid
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select

from app.api.ws_connection import connection_manager
from app.core.security import decode_access_token
from app.db.session import AsyncSessionLocal
from app.models.conversation import Conversation

ws_router = APIRouter()


async def get_ws_user(token: str) -> uuid.UUID | None:
    """Validate WebSocket token and return user ID."""
    try:
        payload = decode_access_token(token)
        if payload is None:
            return None
        user_id_str: str | None = payload.get("sub")
        if user_id_str:
            return uuid.UUID(user_id_str)
    except Exception:
        return None
    return None


async def get_conversation_participants(conversation_id: uuid.UUID) -> list[uuid.UUID]:
    """Get participant IDs for a conversation."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = result.scalar_one_or_none()
        if conversation:
            return list(conversation.participant_ids)
        return []


async def handle_subscribe(
    websocket: WebSocket,
    message: dict[str, Any],
    subscriptions: set[str],
) -> None:
    """Handle subscribe message."""
    channels = message.get("channels", [])
    for channel in channels:
        subscriptions.add(channel)
    await websocket.send_text(
        json.dumps({"type": "subscribed", "channels": list(subscriptions)})
    )


async def handle_unsubscribe(
    websocket: WebSocket,
    message: dict[str, Any],
    subscriptions: set[str],
) -> None:
    """Handle unsubscribe message."""
    channels = message.get("channels", [])
    for channel in channels:
        subscriptions.discard(channel)
    await websocket.send_text(
        json.dumps({"type": "unsubscribed", "channels": channels})
    )


async def handle_typing(
    websocket: WebSocket,
    message: dict[str, Any],
    user_id: uuid.UUID,
) -> None:
    """Handle typing indicator message."""
    conversation_id_str = message.get("conversation_id")
    is_typing = message.get("is_typing", False)

    if not conversation_id_str:
        return

    try:
        conversation_id = uuid.UUID(conversation_id_str)
        participant_ids = await get_conversation_participants(conversation_id)

        if participant_ids:
            await connection_manager.broadcast_typing(
                conversation_id=conversation_id,
                participant_ids=participant_ids,
                user_id=user_id,
                is_typing=is_typing,
            )

        await websocket.send_text(
            json.dumps({"type": "typing_ack", "conversation_id": conversation_id_str})
        )
    except ValueError:
        await websocket.send_text(
            json.dumps({"type": "error", "message": "Invalid conversation_id"})
        )


async def handle_message(
    websocket: WebSocket,
    data: str,
    subscriptions: set[str],
    user_id: uuid.UUID,
) -> None:
    """Handle incoming WebSocket message."""
    try:
        message: dict[str, Any] = json.loads(data)
        msg_type = message.get("type")

        if msg_type == "subscribe":
            await handle_subscribe(websocket, message, subscriptions)
        elif msg_type == "unsubscribe":
            await handle_unsubscribe(websocket, message, subscriptions)
        elif msg_type == "ping":
            await websocket.send_text(json.dumps({"type": "pong"}))
        elif msg_type == "typing":
            await handle_typing(websocket, message, user_id)
    except json.JSONDecodeError:
        await websocket.send_text(json.dumps({"type": "error", "message": "Invalid JSON"}))


@ws_router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
) -> None:
    """WebSocket endpoint for real-time updates."""
    user_id = await get_ws_user(token)
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await connection_manager.connect(websocket, user_id)
    subscriptions: set[str] = set()

    try:
        while True:
            data = await websocket.receive_text()
            await handle_message(websocket, data, subscriptions, user_id)
    except WebSocketDisconnect:
        connection_manager.disconnect(websocket, user_id)
    except Exception:
        connection_manager.disconnect(websocket, user_id)
