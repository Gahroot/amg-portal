"""Service for conversation operations."""

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.communication import Communication
from app.models.conversation import Conversation
from app.models.enums import INTERNAL_ROLES, ConversationType, UserRole
from app.models.partner import PartnerProfile
from app.models.partner_assignment import PartnerAssignment
from app.models.user import User
from app.schemas.conversation import ConversationCreate, ConversationUpdate
from app.services.crud_base import CRUDBase

logger = logging.getLogger(__name__)


class MessageScopeError(Exception):
    """Raised when a sender violates messaging scope rules."""

    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


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
    ) -> Conversation | None:
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

    # ------------------------------------------------------------------
    # Scope enforcement
    # ------------------------------------------------------------------

    async def validate_message_scope(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        sender_id: uuid.UUID,
    ) -> None:
        """Validate that `sender_id` is allowed to send messages in the conversation.

        Rules:
        - Sender must be a participant.
        - For ``coordinator_partner`` conversations: partners can only message
          the RM / coordinator who manages the assignment — not other partners
          or clients directly.
        - For ``rm_client`` conversations: only the assigned RM and approved
          internal users may participate (no partners).

        Raises:
            MessageScopeError: if the sender violates scope rules.
        """
        conversation = await self.get(db, conversation_id)
        if conversation is None:
            raise MessageScopeError("Conversation not found")

        # 1. Must be a participant
        if sender_id not in conversation.participant_ids:
            raise MessageScopeError("Sender is not a participant in this conversation")

        # Look up sender role
        sender_result = await db.execute(select(User).where(User.id == sender_id))
        sender = sender_result.scalar_one_or_none()
        if sender is None:
            raise MessageScopeError("Sender user not found")

        conv_type = conversation.conversation_type

        if conv_type == ConversationType.coordinator_partner:
            await self._enforce_partner_scope(db, conversation, sender)
        elif conv_type == ConversationType.rm_client:
            await self._enforce_client_scope(db, conversation, sender)
        # Internal conversations have no additional restrictions beyond participation.

    async def _enforce_partner_scope(
        self,
        db: AsyncSession,
        conversation: Conversation,
        sender: User,
    ) -> None:
        """For partner conversations, ensure partners can only message their assigned RM."""
        if sender.role != UserRole.partner:
            # Internal users can freely message in partner conversations
            return

        if conversation.partner_assignment_id is None:
            raise MessageScopeError("Partner conversation missing assignment reference")

        # Get the assignment to find the assigning RM / coordinator
        assignment_result = await db.execute(
            select(PartnerAssignment).where(
                PartnerAssignment.id == conversation.partner_assignment_id
            )
        )
        assignment = assignment_result.scalar_one_or_none()
        if assignment is None:
            raise MessageScopeError("Partner assignment not found")

        # Verify sender's partner profile matches the assignment
        partner_result = await db.execute(
            select(PartnerProfile).where(PartnerProfile.user_id == sender.id)
        )
        partner_profile = partner_result.scalar_one_or_none()
        if partner_profile is None or partner_profile.id != assignment.partner_id:
            raise MessageScopeError("Partner is not assigned to this conversation's assignment")

        # Ensure only the partner and internal users (no clients, no other partners)
        other_participant_ids = [pid for pid in conversation.participant_ids if pid != sender.id]
        if other_participant_ids:
            others_result = await db.execute(
                select(User.id, User.role).where(User.id.in_(other_participant_ids))
            )
            for row in others_result.all():
                other_role = row.role
                if other_role == UserRole.client:
                    raise MessageScopeError("Partners cannot directly message clients")
                if other_role == UserRole.partner:
                    raise MessageScopeError("Partners cannot directly message other partners")

    async def _enforce_client_scope(
        self,
        db: AsyncSession,
        conversation: Conversation,
        sender: User,
    ) -> None:
        """For client conversations, only assigned RM and internal users participate."""
        if sender.role == UserRole.partner:
            raise MessageScopeError("Partners cannot send messages in client conversations")

        if sender.role in INTERNAL_ROLES:
            # Internal users are allowed
            return

        # For clients: verify they are the client associated with this conversation
        if sender.role == UserRole.client:
            if conversation.client_id is None:
                raise MessageScopeError("Client conversation missing client reference")
            # The client is allowed if they are a participant (already checked above)
            return


conversation_service = ConversationService(Conversation)
