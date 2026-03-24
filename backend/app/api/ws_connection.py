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

    async def broadcast_preference_update(
        self,
        user_id: uuid.UUID,
        preferences: dict[str, Any],
        version: int,
        source_device_id: str | None = None,
    ) -> None:
        """Broadcast preference update to all devices for a user.

        This enables real-time sync of preferences across devices.
        Optionally excludes the source device to avoid echo.
        """
        message = {
            "type": "preference_update",
            "data": {
                "preferences": preferences,
                "version": version,
                "source_device_id": source_device_id,
            },
        }
        await self.send_personal(message, user_id)

    async def broadcast_read_status(
        self,
        user_id: uuid.UUID,
        entity_type: str,
        entity_id: uuid.UUID,
        is_read: bool,
        read_at: str | None = None,
        source_device_id: str | None = None,
    ) -> None:
        """Broadcast read status update to all devices for a user.

        This enables real-time sync of read status across devices.
        """
        message = {
            "type": "read_status_update",
            "data": {
                "entity_type": entity_type,
                "entity_id": str(entity_id),
                "is_read": is_read,
                "read_at": read_at,
                "source_device_id": source_device_id,
            },
        }
        await self.send_personal(message, user_id)

    async def broadcast_to_other_devices(
        self,
        user_id: uuid.UUID,
        message: dict[str, Any],
        exclude_device_id: str | None = None,
    ) -> None:
        """Broadcast a message to all of a user's devices except the source.

        The message should include device info if device exclusion is needed.
        """
        if exclude_device_id:
            message = {**message, "exclude_device_id": exclude_device_id}
        await self.send_personal(message, user_id)


# Global connection manager instance
connection_manager = ConnectionManager()
