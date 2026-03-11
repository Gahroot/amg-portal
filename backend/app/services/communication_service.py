"""Service for communication/message operations."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.ws_connection import connection_manager
from app.models.communication import Communication
from app.models.conversation import Conversation
from app.schemas.communication import CommunicationCreate, SendMessageRequest
from app.services.crud_base import CRUDBase


class CommunicationService(CRUDBase[Communication, CommunicationCreate, dict[str, Any]]):
    """Service for communication/message operations."""

    async def _verify_participation(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        """Verify that user is a participant in the conversation."""
        result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
        conversation = result.scalar_one_or_none()
        return conversation is not None and user_id in conversation.participant_ids

    async def _get_conversation(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
    ) -> Conversation | None:
        """Get a conversation by ID."""
        result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
        return result.scalar_one_or_none()

    async def send_message(
        self,
        db: AsyncSession,
        sender_id: uuid.UUID,
        data: SendMessageRequest,
    ) -> Communication:
        """Send a message to a conversation. Verifies sender is a participant."""
        conversation = None
        if data.conversation_id:
            if not await self._verify_participation(db, data.conversation_id, sender_id):
                raise ValueError("User is not a participant in this conversation")
            # Get conversation to update last_activity_at
            conversation = await self._get_conversation(db, data.conversation_id)
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

        # Broadcast via WebSocket to all participants
        if conversation and communication:
            await self.broadcast_new_message(conversation, communication, sender_id)

        return communication

    async def get_messages_for_conversation(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[Communication], int]:
        """Get messages for a conversation. Verifies user is a participant."""
        if not await self._verify_participation(db, conversation_id, user_id):
            return [], 0
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
    ) -> Communication | None:
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
    ) -> dict[str, Any]:
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

    async def broadcast_new_message(
        self,
        conversation: Conversation,
        message: Communication,
        sender_id: uuid.UUID,
    ) -> None:
        """Broadcast new message via WebSocket to all conversation participants."""
        message_data = {
            "id": str(message.id),
            "conversation_id": str(message.conversation_id) if message.conversation_id else None,
            "channel": message.channel,
            "status": message.status,
            "sender_id": str(message.sender_id) if message.sender_id else None,
            "body": message.body,
            "attachment_ids": message.attachment_ids,
            "sent_at": message.sent_at.isoformat() if message.sent_at else None,
            "created_at": message.created_at.isoformat() if message.created_at else None,
        }
        await connection_manager.broadcast_to_conversation(
            conversation_id=conversation.id,
            participant_ids=conversation.participant_ids,
            message={"type": "new_message", "data": message_data},
            exclude_user_id=sender_id,
        )

    async def broadcast_read_receipt(
        self,
        conversation: Conversation,
        message: Communication,
        reader_id: uuid.UUID,
    ) -> None:
        """Broadcast read receipt to conversation participants."""
        receipt_data = {
            "message_id": str(message.id),
            "conversation_id": str(conversation.id),
            "reader_id": str(reader_id),
            "read_at": datetime.now(UTC).isoformat(),
        }
        # Notify the sender that their message was read
        if message.sender_id and message.sender_id != reader_id:
            await connection_manager.send_personal(
                message={"type": "message_read", "data": receipt_data},
                user_id=message.sender_id,
            )


communication_service = CommunicationService(Communication)
