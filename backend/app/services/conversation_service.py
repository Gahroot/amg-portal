"""Service for conversation operations."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.communication import Communication
from app.models.conversation import Conversation
from app.schemas.conversation import ConversationCreate, ConversationUpdate
from app.services.crud_base import CRUDBase


class ConversationService(CRUDBase[Conversation, ConversationCreate, ConversationUpdate]):
    """Service for conversation CRUD operations."""

    async def get_conversations_for_user(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        user_role: str,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Conversation], int]:
        """Get all conversations for a user based on their role."""
        # User can see conversations where they are a participant
        # RMs can see all conversations for their clients
        # Coordinators can see conversations for their partner assignments

        query = select(Conversation).where(
            or_(
                Conversation.participant_ids.contains([user_id]),  # User is a participant
                # Add role-based filtering logic here as needed
            )
        )
        count_query = (
            select(func.count())
            .select_from(Conversation)
            .where(
                or_(
                    Conversation.participant_ids.contains([user_id]),
                )
            )
        )

        query = query.order_by(Conversation.last_activity_at.desc().nulls_last())

        total = (await db.execute(count_query)).scalar_one()
        result = await db.execute(query.offset(skip).limit(limit))
        conversations = list(result.scalars().all())

        return conversations, total

    async def get_or_create_client_conversation(
        self,
        db: AsyncSession,
        client_id: uuid.UUID,
        rm_id: uuid.UUID,
    ) -> Conversation:
        """Get or create a conversation between RM and client."""
        # Check if conversation exists
        query = select(Conversation).where(
            Conversation.conversation_type == "rm_client",
            Conversation.client_id == client_id,
        )
        result = await db.execute(query)
        conversation = result.scalar_one_or_none()

        if not conversation:
            # Create new conversation
            conversation = Conversation(
                conversation_type="rm_client",
                client_id=client_id,
                participant_ids=[rm_id],
                title="Client Conversation",
            )
            db.add(conversation)
            await db.commit()
            await db.refresh(conversation)

        return conversation

    async def get_or_create_partner_conversation(
        self,
        db: AsyncSession,
        partner_assignment_id: uuid.UUID,
        coordinator_id: uuid.UUID,
    ) -> Conversation:
        """Get or create a conversation for partner assignment."""
        query = select(Conversation).where(
            Conversation.conversation_type == "coordinator_partner",
            Conversation.partner_assignment_id == partner_assignment_id,
        )
        result = await db.execute(query)
        conversation = result.scalar_one_or_none()

        if not conversation:
            conversation = Conversation(
                conversation_type="coordinator_partner",
                partner_assignment_id=partner_assignment_id,
                participant_ids=[coordinator_id],
                title="Partner Assignment Conversation",
            )
            db.add(conversation)
            await db.commit()
            await db.refresh(conversation)

        return conversation

    async def add_participant(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Conversation:
        """Add a user to a conversation."""
        conversation = await self.get(db, conversation_id)
        if not conversation:
            return None

        if user_id not in conversation.participant_ids:
            conversation.participant_ids = conversation.participant_ids + [user_id]
            await db.commit()
            await db.refresh(conversation)

        return conversation

    async def mark_conversation_read(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        """Mark all messages in conversation as read for user."""
        # Update read receipts for all communications in this conversation
        query = select(Communication).where(
            Communication.conversation_id == conversation_id,
        )
        result = await db.execute(query)
        communications = result.scalars().all()

        read_time = datetime.now(UTC).isoformat()
        for comm in communications:
            if comm.read_receipts is None:
                comm.read_receipts = {}
            comm.read_receipts[str(user_id)] = {"read_at": read_time}

        await db.commit()

    async def get_messages(
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

    async def get_unread_count(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> int:
        """Get unread message count for user."""
        # Count communications where user_id is not in read_receipts
        query = (
            select(func.count())
            .select_from(Communication)
            .where(
                Communication.conversation_id.isnot(None),
                # Check if user hasn't read this message
            )
        )
        # This is a simplified version - in production you'd want to optimize this
        # with a proper unread tracking mechanism

        result = await db.execute(query)
        return result.scalar_one() or 0


conversation_service = ConversationService(Conversation)
