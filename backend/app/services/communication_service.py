"""Service for communication/message operations."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.communication import Communication
from app.models.conversation import Conversation
from app.schemas.communication import CommunicationCreate, SendMessageRequest
from app.services.crud_base import CRUDBase


class CommunicationService(CRUDBase[Communication, CommunicationCreate, dict[str, Any]]):
    """Service for communication/message operations."""

    async def send_message(
        self,
        db: AsyncSession,
        sender_id: uuid.UUID,
        data: SendMessageRequest,
    ) -> Communication:
        """Send a message to a conversation."""
        # Get conversation to update last_activity_at
        if data.conversation_id:
            conv_result = await db.execute(
                select(Conversation).where(Conversation.id == data.conversation_id)
            )
            conversation = conv_result.scalar_one_or_none()
            if conversation:
                conversation.last_activity_at = datetime.now(UTC)

        # Create communication
        communication = Communication(
            conversation_id=data.conversation_id,
            channel="in_portal",
            status="sent",
            sender_id=sender_id,
            body=data.body,
            attachment_ids=data.attachment_ids,
            sent_at=datetime.now(UTC),
        )
        db.add(communication)
        await db.commit()
        await db.refresh(communication)

        # TODO: Broadcast via WebSocket to all participants
        # await broadcast_via_websocket(conversation_id, communication)

        return communication

    async def get_messages_for_conversation(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[Communication], int]:
        """Get messages for a conversation."""
        query = select(Communication).where(Communication.conversation_id == conversation_id)
        count_query = (
            select(func.count())
            .select_from(Communication)
            .where(Communication.conversation_id == conversation_id)
        )

        query = query.order_by(Communication.created_at.asc())

        total = (await db.execute(count_query)).scalar_one()
        result = await db.execute(query.offset(skip).limit(limit))
        messages = list(result.scalars().all())

        return messages, total

    async def mark_read(
        self,
        db: AsyncSession,
        communication_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Communication:
        """Mark a communication as read by user."""
        communication = await self.get(db, communication_id)
        if not communication:
            return None

        if communication.read_receipts is None:
            communication.read_receipts = {}

        communication.read_receipts[str(user_id)] = {"read_at": datetime.now(UTC).isoformat()}
        await db.commit()
        await db.refresh(communication)

        return communication

    async def get_unread_count(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> dict[str, int]:
        """Get unread message count grouped by conversation."""
        # This is a simplified version - in production you'd want a dedicated
        # unread tracking table for better performance

        # Get all conversations the user is part of
        conv_result = await db.execute(
            select(Conversation).where(Conversation.participant_ids.contains([user_id]))
        )
        conversations = conv_result.scalars().all()

        counts: dict[str, int] = {}
        total = 0

        for conv in conversations:
            # Count messages where user hasn't read
            comm_result = await db.execute(
                select(func.count())
                .select_from(Communication)
                .where(
                    Communication.conversation_id == conv.id,
                    # Check read receipts - this is simplified
                )
            )
            count = comm_result.scalar_one() or 0
            counts[str(conv.id)] = count
            total += count

        return {"total": total, "by_conversation": counts}

    async def broadcast_via_websocket(
        self,
        conversation_id: uuid.UUID,
        message: Communication,
    ) -> None:
        """Broadcast message via WebSocket to all participants."""
        # This will be implemented when we add WebSocket support
        # Import the connection manager and send to all participants
        pass


communication_service = CommunicationService(Communication)
