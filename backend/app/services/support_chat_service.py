"""Service for support chat operations."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import and_, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundException, ValidationException
from app.models.support_chat import (
    SupportAgentStatus,
    SupportConversation,
    SupportMessage,
    SupportOfflineMessage,
)
from app.models.user import User
from app.schemas.support_chat import (
    AgentStatusUpdate,
    OfflineMessageCreate,
    SupportConversationCreate,
    SupportMessageCreate,
)


class SupportChatService:
    """Service class for support chat operations."""

    # Support hours configuration (can be made configurable later)
    SUPPORT_HOURS: dict[str, Any] = {
        "timezone": "UTC",
        "hours": {
            "monday": {"start": "09:00", "end": "18:00"},
            "tuesday": {"start": "09:00", "end": "18:00"},
            "wednesday": {"start": "09:00", "end": "18:00"},
            "thursday": {"start": "09:00", "end": "18:00"},
            "friday": {"start": "09:00", "end": "18:00"},
            "saturday": None,
            "sunday": None,
        },
    }

    async def get_or_create_conversation(
        self, db: AsyncSession, user_id: uuid.UUID, data: SupportConversationCreate
    ) -> SupportConversation:
        """Get existing open conversation or create a new one."""
        # Check for existing open conversation
        result = await db.execute(
            select(SupportConversation)
            .where(
                SupportConversation.user_id == user_id,
                SupportConversation.status.in_(["open", "waiting", "in_progress"]),
            )
            .order_by(desc(SupportConversation.created_at))
        )
        existing = result.scalar_one_or_none()

        if existing:
            return existing

        # Create new conversation
        conversation = SupportConversation(
            user_id=user_id,
            subject=data.subject,
            priority=data.priority,
            status="open",
        )
        db.add(conversation)
        await db.flush()

        # Add initial message
        message = SupportMessage(
            conversation_id=conversation.id,
            sender_id=user_id,
            sender_type="user",
            body=data.message,
        )
        db.add(message)

        # Update conversation with last message info
        conversation.last_message_at = datetime.now(UTC)
        conversation.last_message_preview = (
            data.message[:200] if data.message else None
        )

        await db.commit()
        await db.refresh(conversation)

        return conversation

    async def get_conversation(
        self, db: AsyncSession, conversation_id: uuid.UUID, user_id: uuid.UUID | None = None
    ) -> SupportConversation | None:
        """Get a conversation by ID, optionally checking user ownership."""
        query = select(SupportConversation).where(
            SupportConversation.id == conversation_id
        )
        if user_id:
            query = query.where(SupportConversation.user_id == user_id)

        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def get_user_conversations(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[SupportConversation], int]:
        """Get all conversations for a user."""
        query = select(SupportConversation).where(
            SupportConversation.user_id == user_id
        )

        if status:
            query = query.where(SupportConversation.status == status)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar() or 0

        # Get paginated results
        query = query.order_by(desc(SupportConversation.last_message_at)).offset(
            skip
        ).limit(limit)
        result = await db.execute(query)
        conversations = list(result.scalars().all())

        return conversations, total

    async def get_agent_conversations(
        self,
        db: AsyncSession,
        agent_id: uuid.UUID,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[SupportConversation], int]:
        """Get all conversations assigned to an agent or unassigned."""
        query = select(SupportConversation).where(
            or_(
                SupportConversation.assigned_agent_id == agent_id,
                and_(
                    SupportConversation.assigned_agent_id.is_(None),
                    SupportConversation.status.in_(["open", "waiting"]),
                ),
            )
        )

        if status:
            query = query.where(SupportConversation.status == status)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar() or 0

        # Get paginated results with user info
        query = (
            query.options(selectinload(SupportConversation.user))
            .order_by(desc(SupportConversation.priority), desc(SupportConversation.last_message_at))
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(query)
        conversations = list(result.scalars().all())

        return conversations, total

    async def send_message(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        sender_id: uuid.UUID,
        sender_type: str,
        data: SupportMessageCreate,
        is_internal: bool = False,
    ) -> SupportMessage:
        """Send a message in a conversation."""
        conversation = await self.get_conversation(db, conversation_id)
        if not conversation:
            raise NotFoundException("Conversation not found")

        if conversation.status == "closed":
            # Reopen conversation
            conversation.status = "in_progress"
            conversation.closed_at = None
            conversation.closed_by = None

        message = SupportMessage(
            conversation_id=conversation_id,
            sender_id=sender_id,
            sender_type=sender_type,
            body=data.body,
            attachment_ids=data.attachment_ids,
            is_internal=is_internal,
        )
        db.add(message)

        # Update conversation
        conversation.last_message_at = datetime.now(UTC)
        conversation.last_message_preview = data.body[:200] if data.body else None
        conversation.updated_at = datetime.now(UTC)

        # Mark as read by sender
        if sender_type == "user":
            message.read_by_user_at = datetime.now(UTC)
        elif sender_type == "agent":
            message.read_by_agent_at = datetime.now(UTC)

        await db.commit()
        await db.refresh(message)

        return message

    async def get_messages(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user_type: str = "user",
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[SupportMessage], int]:
        """Get messages for a conversation."""
        query = select(SupportMessage).where(
            SupportMessage.conversation_id == conversation_id
        )

        # Users can't see internal notes
        if user_type == "user":
            query = query.where(SupportMessage.is_internal == False)  # noqa: E712

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar() or 0

        # Get paginated results
        query = (
            query.options(selectinload(SupportMessage.sender))
            .order_by(SupportMessage.created_at)
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(query)
        messages = list(result.scalars().all())

        return messages, total

    async def mark_messages_read(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user_type: str,
    ) -> None:
        """Mark all messages in a conversation as read."""
        now = datetime.now(UTC)
        field = "read_by_user_at" if user_type == "user" else "read_by_agent_at"

        await db.execute(
            update(SupportMessage)
            .where(
                SupportMessage.conversation_id == conversation_id,
                SupportMessage.is_internal == False,  # noqa: E712
            )
            .values(**{field: now})
        )
        await db.commit()

    async def get_unread_count(
        self, db: AsyncSession, conversation_id: uuid.UUID, user_type: str
    ) -> int:
        """Get unread message count for a conversation."""
        field = (
            SupportMessage.read_by_user_at
            if user_type == "user"
            else SupportMessage.read_by_agent_at
        )
        sender_type = "agent" if user_type == "user" else "user"

        result = await db.execute(
            select(func.count())
            .select_from(SupportMessage)
            .where(
                SupportMessage.conversation_id == conversation_id,
                SupportMessage.sender_type == sender_type,
                SupportMessage.is_internal == False,  # noqa: E712
                or_(field.is_(None), field < SupportMessage.created_at),
            )
        )
        return result.scalar() or 0

    async def assign_agent(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        agent_id: uuid.UUID,
    ) -> SupportConversation:
        """Assign an agent to a conversation."""
        conversation = await self.get_conversation(db, conversation_id)
        if not conversation:
            raise NotFoundException("Conversation not found")

        # Verify agent exists and is a support agent
        agent_result = await db.execute(
            select(User).where(User.id == agent_id)
        )
        agent = agent_result.scalar_one_or_none()
        if not agent:
            raise NotFoundException("Agent not found")

        conversation.assigned_agent_id = agent_id
        conversation.status = "in_progress"
        conversation.updated_at = datetime.now(UTC)

        # Update agent's active conversation count
        await self._update_agent_conversation_count(db, agent_id, 1)

        await db.commit()
        await db.refresh(conversation)

        return conversation

    async def close_conversation(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        closed_by: uuid.UUID,
    ) -> SupportConversation:
        """Close a conversation."""
        conversation = await self.get_conversation(db, conversation_id)
        if not conversation:
            raise NotFoundException("Conversation not found")

        conversation.status = "closed"
        conversation.closed_at = datetime.now(UTC)
        conversation.closed_by = closed_by
        conversation.updated_at = datetime.now(UTC)

        # Update agent's active conversation count
        if conversation.assigned_agent_id:
            await self._update_agent_conversation_count(
                db, conversation.assigned_agent_id, -1
            )

        await db.commit()
        await db.refresh(conversation)

        return conversation

    async def submit_satisfaction(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        rating: int,
        comment: str | None = None,
    ) -> SupportConversation:
        """Submit satisfaction survey for a closed conversation."""
        if rating < 1 or rating > 5:
            raise ValidationException("Rating must be between 1 and 5")

        conversation = await self.get_conversation(db, conversation_id)
        if not conversation:
            raise NotFoundException("Conversation not found")

        if conversation.status != "closed":
            raise ValidationException("Can only submit satisfaction for closed conversations")

        conversation.satisfaction_rating = rating
        conversation.satisfaction_comment = comment

        await db.commit()
        await db.refresh(conversation)

        return conversation

    # Offline messages
    async def create_offline_message(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        data: OfflineMessageCreate,
    ) -> SupportOfflineMessage:
        """Create an offline message for when support is unavailable."""
        offline_msg = SupportOfflineMessage(
            user_id=user_id,
            name=data.name,
            email=data.email,
            subject=data.subject,
            message=data.message,
        )
        db.add(offline_msg)
        await db.commit()
        await db.refresh(offline_msg)

        return offline_msg

    async def get_offline_messages(
        self,
        db: AsyncSession,
        processed: bool | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[SupportOfflineMessage], int]:
        """Get offline messages (for agents)."""
        query = select(SupportOfflineMessage)

        if processed is not None:
            query = query.where(SupportOfflineMessage.processed == processed)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar() or 0

        # Get paginated results
        query = query.order_by(desc(SupportOfflineMessage.created_at)).offset(
            skip
        ).limit(limit)
        result = await db.execute(query)
        messages = list(result.scalars().all())

        return messages, total

    # Agent status
    async def update_agent_status(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        data: AgentStatusUpdate,
    ) -> SupportAgentStatus:
        """Update agent's online status."""
        result = await db.execute(
            select(SupportAgentStatus).where(SupportAgentStatus.user_id == user_id)
        )
        status = result.scalar_one_or_none()

        now = datetime.now(UTC)
        is_online = data.status in ["online", "away"]

        if status:
            status.status = data.status
            status.is_online = is_online
            status.last_seen_at = now
            if data.max_conversations is not None:
                status.max_conversations = data.max_conversations
        else:
            status = SupportAgentStatus(
                user_id=user_id,
                status=data.status,
                is_online=is_online,
                last_seen_at=now,
                max_conversations=data.max_conversations or 5,
            )
            db.add(status)

        await db.commit()
        await db.refresh(status)

        return status

    async def get_agent_status(
        self, db: AsyncSession, user_id: uuid.UUID
    ) -> SupportAgentStatus | None:
        """Get agent's status."""
        result = await db.execute(
            select(SupportAgentStatus).where(SupportAgentStatus.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_availability(self, db: AsyncSession) -> dict[str, Any]:
        """Get support availability status."""
        # Count online agents with capacity
        result = await db.execute(
            select(func.count())
            .select_from(SupportAgentStatus)
            .where(
                SupportAgentStatus.is_online == True,  # noqa: E712
                SupportAgentStatus.status == "online",
                SupportAgentStatus.active_conversations
                < SupportAgentStatus.max_conversations,
            )
        )
        available_agents = result.scalar() or 0

        # Calculate expected wait time based on queue
        queue_result = await db.execute(
            select(func.count())
            .select_from(SupportConversation)
            .where(
                SupportConversation.status == "waiting",
                SupportConversation.assigned_agent_id.is_(None),
            )
        )
        queue_size = queue_result.scalar() or 0

        # Estimate wait time (2 minutes per person in queue, minimum 0)
        expected_wait = max(0, queue_size * 2) if available_agents > 0 else None

        # Check if within support hours
        now = datetime.now(UTC)
        day_name = now.strftime("%A").lower()
        hours_config: dict[str, str] | None = self.SUPPORT_HOURS["hours"].get(  # pyright: ignore[reportArgumentType]
            day_name
        )

        within_hours = False
        if hours_config and available_agents > 0:
            # Simple check - can be enhanced with proper timezone handling
            within_hours = True

        return {
            "is_online": available_agents > 0 and within_hours,
            "available_agents": available_agents,
            "expected_wait_minutes": expected_wait,
            "support_hours": self.SUPPORT_HOURS,
            "message": (
                None
                if available_agents > 0 and within_hours
                else "Support team is currently offline. "
                "Leave a message and we'll get back to you soon."
            ),
        }

    async def _update_agent_conversation_count(
        self, db: AsyncSession, agent_id: uuid.UUID, delta: int
    ) -> None:
        """Update agent's active conversation count."""
        result = await db.execute(
            select(SupportAgentStatus).where(SupportAgentStatus.user_id == agent_id)
        )
        status = result.scalar_one_or_none()
        if status:
            status.active_conversations = max(
                0, status.active_conversations + delta
            )


support_chat_service = SupportChatService()
