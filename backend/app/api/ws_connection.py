"""WebSocket connection manager for real-time messaging."""

import json
import uuid
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections for real-time messaging."""

    def __init__(self) -> None:
        # user_id -> set of WebSocket connections
        self.active_connections: dict[uuid.UUID, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: uuid.UUID) -> None:
        """Connect a WebSocket for a user."""
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: uuid.UUID) -> None:
        """Disconnect a WebSocket for a user."""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal(self, message: dict[str, Any], user_id: uuid.UUID) -> None:
        """Send a message to a specific user."""
        if user_id in self.active_connections:
            # Remove disconnected websockets
            to_remove = set()
            for websocket in self.active_connections[user_id]:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception:
                    to_remove.add(websocket)

            # Clean up disconnected websockets
            for ws in to_remove:
                self.disconnect(ws, user_id)

    async def broadcast_to_conversation(
        self,
        conversation_id: uuid.UUID,
        participant_ids: list[uuid.UUID],
        message: dict[str, Any],
        exclude_user_id: uuid.UUID | None = None,
    ) -> None:
        """Broadcast a message to all participants in a conversation."""
        for user_id in participant_ids:
            if exclude_user_id and user_id == exclude_user_id:
                continue
            await self.send_personal(message, user_id)

    async def broadcast_notification(
        self, user_id: uuid.UUID, notification: dict[str, Any]
    ) -> None:
        """Send a notification to a specific user."""
        message = {
            "type": "notification",
            "data": notification,
        }
        await self.send_personal(message, user_id)

    async def broadcast_typing(
        self,
        conversation_id: uuid.UUID,
        participant_ids: list[uuid.UUID],
        user_id: uuid.UUID,
        is_typing: bool,
    ) -> None:
        """Broadcast typing indicator to conversation participants."""
        message = {
            "type": "typing",
            "conversation_id": str(conversation_id),
            "user_id": str(user_id),
            "is_typing": is_typing,
        }
        for participant_id in participant_ids:
            if participant_id != user_id:
                await self.send_personal(message, participant_id)


# Global connection manager instance
connection_manager = ConnectionManager()
