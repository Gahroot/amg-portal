"""WebSocket endpoint for real-time communications."""

import json
import uuid
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.api.ws_connection import connection_manager
from app.core.security import decode_access_token

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


@ws_router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    """WebSocket endpoint for real-time updates.

    Client should send messages in the format:
    {
        "type": "subscribe" | "unsubscribe" | "typing",
        "channels": ["messages", "notifications"],
        "conversation_id": "...",  // for typing
    }
    """
    # Authenticate
    user_id = await get_ws_user(token)
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Connect
    await connection_manager.connect(websocket, user_id)

    # Track subscriptions
    subscriptions: set[str] = set()

    try:
        while True:
            data = await websocket.receive_text()
            try:
                message: dict[str, Any] = json.loads(data)
                msg_type = message.get("type")

                if msg_type == "subscribe":
                    # Subscribe to channels
                    channels = message.get("channels", [])
                    for channel in channels:
                        subscriptions.add(channel)

                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "subscribed",
                                "channels": list(subscriptions),
                            }
                        )
                    )

                elif msg_type == "unsubscribe":
                    # Unsubscribe from channels
                    channels = message.get("channels", [])
                    for channel in channels:
                        subscriptions.discard(channel)

                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "unsubscribed",
                                "channels": channels,
                            }
                        )
                    )

                elif msg_type == "ping":
                    # Heartbeat/ping
                    await websocket.send_text(json.dumps({"type": "pong"}))

                elif msg_type == "typing":
                    # Forward typing indicator to conversation participants
                    conversation_id = message.get("conversation_id")

                    if conversation_id:
                        # Get conversation participants
                        # This would require DB access - for now just acknowledge
                        await websocket.send_text(
                            json.dumps(
                                {
                                    "type": "typing_ack",
                                    "conversation_id": conversation_id,
                                }
                            )
                        )

            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "message": "Invalid JSON"}))

    except WebSocketDisconnect:
        connection_manager.disconnect(websocket, user_id)
    except Exception:
        connection_manager.disconnect(websocket, user_id)
