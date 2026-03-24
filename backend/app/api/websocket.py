"""WebSocket endpoint for real-time communications."""

import asyncio
import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select

from app.api.ws_connection import connection_manager
from app.core.security import decode_access_token
from app.db.session import AsyncSessionLocal
from app.models.conversation import Conversation
from app.models.device_session import DeviceSession
from app.models.read_status import ReadStatus
from app.models.user_preferences import UserPreferences

ws_router = APIRouter()
logger = logging.getLogger(__name__)


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


async def handle_device_register(
    websocket: WebSocket,
    message: dict[str, Any],
    user_id: uuid.UUID,
) -> None:
    """Handle device registration message."""
    device_id = message.get("device_id")
    device_type = message.get("device_type", "web")
    device_name = message.get("device_name")

    if not device_id:
        await websocket.send_text(
            json.dumps({"type": "error", "message": "device_id required"})
        )
        return

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(DeviceSession).where(
                    DeviceSession.user_id == user_id,
                    DeviceSession.device_id == device_id,
                )
            )
            session = result.scalar_one_or_none()

            now = datetime.now(UTC)

            if session:
                session.device_type = device_type
                session.device_name = device_name
                session.last_seen_at = now
                session.is_active = True
            else:
                session = DeviceSession(
                    user_id=user_id,
                    device_id=device_id,
                    device_type=device_type,
                    device_name=device_name,
                    last_seen_at=now,
                    is_active=True,
                )
                db.add(session)

            await db.commit()

        await websocket.send_text(
            json.dumps({
                "type": "device_registered",
                "device_id": device_id,
            })
        )
    except Exception as e:
        logger.exception(f"Failed to register device: {e}")
        await websocket.send_text(
            json.dumps({"type": "error", "message": "Failed to register device"})
        )


async def handle_preference_sync(
    websocket: WebSocket,
    message: dict[str, Any],
    user_id: uuid.UUID,
) -> None:
    """Handle preference sync message from a device.

    Updates preferences and broadcasts to other devices.
    """
    device_id = message.get("device_id")
    preferences = message.get("preferences", {})
    client_version = message.get("version", 1)

    if not device_id:
        await websocket.send_text(
            json.dumps({"type": "error", "message": "device_id required"})
        )
        return

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(UserPreferences).where(UserPreferences.user_id == user_id)
            )
            user_prefs = result.scalar_one_or_none()

            if user_prefs is None:
                user_prefs = UserPreferences(
                    user_id=user_id,
                    ui_preferences=preferences,
                    version=1,
                    sync_enabled=True,
                )
                db.add(user_prefs)
                new_version = 1
            else:
                # Check for version conflict
                if client_version < user_prefs.version:
                    # Client is behind, send current state
                    await websocket.send_text(
                        json.dumps({
                            "type": "preference_conflict",
                            "server_version": user_prefs.version,
                            "client_version": client_version,
                            "preferences": user_prefs.ui_preferences,
                        })
                    )
                    return

                # Update preferences
                current_ui = user_prefs.ui_preferences.copy()
                current_ui.update(preferences)
                user_prefs.ui_preferences = current_ui
                user_prefs.version = user_prefs.version + 1
                new_version = user_prefs.version

            await db.commit()

        # Broadcast to other devices
        await connection_manager.broadcast_preference_update(
            user_id=user_id,
            preferences=preferences,
            version=new_version,
            source_device_id=device_id,
        )

        await websocket.send_text(
            json.dumps({
                "type": "preference_sync_ack",
                "version": new_version,
                "synced_at": datetime.now(UTC).isoformat(),
            })
        )
    except Exception as e:
        logger.exception(f"Failed to sync preferences: {e}")
        await websocket.send_text(
            json.dumps({"type": "error", "message": "Failed to sync preferences"})
        )


async def handle_read_status_sync(
    websocket: WebSocket,
    message: dict[str, Any],
    user_id: uuid.UUID,
) -> None:
    """Handle read status sync message from a device.

    Updates read status and broadcasts to other devices.
    """
    device_id = message.get("device_id")
    entity_type = message.get("entity_type")
    entity_id_str = message.get("entity_id")
    is_read = message.get("is_read", True)

    if not device_id or not entity_type or not entity_id_str:
        await websocket.send_text(
            json.dumps({
                "type": "error",
                "message": "device_id, entity_type, and entity_id required",
            })
        )
        return

    # Type assertions after validation
    entity_type_str: str = str(entity_type)

    try:
        entity_id = uuid.UUID(entity_id_str)
        now = datetime.now(UTC)

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ReadStatus).where(
                    ReadStatus.user_id == user_id,
                    ReadStatus.entity_type == entity_type_str,
                    ReadStatus.entity_id == entity_id,
                )
            )
            status_record = result.scalar_one_or_none()

            if status_record:
                status_record.is_read = is_read
                status_record.read_at = now if is_read else None
                status_record.device_id = device_id
                status_record.updated_at = now
            else:
                status_record = ReadStatus(
                    user_id=user_id,
                    entity_type=entity_type_str,
                    entity_id=entity_id,
                    is_read=is_read,
                    read_at=now if is_read else None,
                    device_id=device_id,
                )
                db.add(status_record)

            await db.commit()

        # Broadcast to other devices
        await connection_manager.broadcast_read_status(
            user_id=user_id,
            entity_type=entity_type_str,
            entity_id=entity_id,
            is_read=is_read,
            read_at=now.isoformat() if is_read else None,
            source_device_id=device_id,
        )

        await websocket.send_text(
            json.dumps({
                "type": "read_status_sync_ack",
                "entity_type": entity_type_str,
                "entity_id": str(entity_id),
                "is_read": is_read,
                "synced_at": now.isoformat(),
            })
        )
    except ValueError:
        await websocket.send_text(
            json.dumps({"type": "error", "message": "Invalid entity_id"})
        )
    except Exception as e:
        logger.exception(f"Failed to sync read status: {e}")
        await websocket.send_text(
            json.dumps({"type": "error", "message": "Failed to sync read status"})
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
        elif msg_type == "device_register":
            await handle_device_register(websocket, message, user_id)
        elif msg_type == "preference_sync":
            await handle_preference_sync(websocket, message, user_id)
        elif msg_type == "read_status_sync":
            await handle_read_status_sync(websocket, message, user_id)
        elif msg_type == "auth":
            # Auth messages should only be sent before connection is established
            await websocket.send_text(
                json.dumps({"type": "auth_error", "message": "Already authenticated"})
            )
    except json.JSONDecodeError:
        await websocket.send_text(json.dumps({"type": "error", "message": "Invalid JSON"}))


@ws_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """WebSocket endpoint for real-time updates.

    Uses first-message authentication: client must send
    {"type": "auth", "token": "<jwt>"} as the first message.
    """
    await websocket.accept()

    # Wait for auth message with timeout
    try:
        data = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
        message: dict[str, Any] = json.loads(data)

        if message.get("type") != "auth":
            await websocket.send_text(
                json.dumps({"type": "auth_error", "message": "First message must be auth"})
            )
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        token = message.get("token")
        if not token:
            await websocket.send_text(
                json.dumps({"type": "auth_error", "message": "Token required"})
            )
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        user_id = await get_ws_user(token)
        if not user_id:
            await websocket.send_text(
                json.dumps({"type": "auth_error", "message": "Invalid token"})
            )
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        await websocket.send_text(json.dumps({"type": "auth_success"}))

    except TimeoutError:
        await websocket.send_text(
            json.dumps({"type": "auth_error", "message": "Auth timeout"})
        )
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    except json.JSONDecodeError:
        await websocket.send_text(
            json.dumps({"type": "auth_error", "message": "Invalid JSON"})
        )
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
