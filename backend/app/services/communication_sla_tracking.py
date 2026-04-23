"""SLA tracking mixin for CommunicationService."""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.enums import CommunicationType, ConversationType, UserRole
from app.models.user import User

logger = logging.getLogger(__name__)


class CommunicationSLAMixin:
    """Mixin providing SLA tracking for coordinator_partner and rm_client conversations."""

    async def _find_participant_by_role(
        self,
        db: AsyncSession,
        participant_ids: list[uuid.UUID],
        role: str,
    ) -> User | None:
        """Return the first conversation participant whose role matches."""
        if not participant_ids:
            return None
        result = await db.execute(
            select(User).where(
                User.id.in_(participant_ids),
                User.role == role,
            )
        )
        return result.scalars().first()

    async def _handle_sla_tracking(
        self,
        db: AsyncSession,
        conversation: Conversation,
        sender_id: uuid.UUID,
    ) -> None:
        """Start or stop the SLA clock based on who sent the message.

        coordinator_partner conversations:
          - Partner message  → start clock (4h standard, 1h if assignment is priority)
          - Coordinator/internal message → stop clock

        rm_client conversations:
          - Client message   → start clock (4h standard, 2h if title flags urgent/decision)
          - RM/internal message → stop clock
        """
        entity_id = str(conversation.id)
        conv_type = conversation.conversation_type

        sender_result = await db.execute(select(User).where(User.id == sender_id))
        sender = sender_result.scalar_one_or_none()
        if not sender:
            return

        if conv_type == ConversationType.coordinator_partner:
            await self._handle_coordinator_partner_sla(db, conversation, entity_id, sender)
        elif conv_type == ConversationType.rm_client:
            await self._handle_rm_client_sla(db, conversation, entity_id, sender)

    async def _handle_coordinator_partner_sla(
        self,
        db: AsyncSession,
        conversation: Conversation,
        entity_id: str,
        sender: User,
    ) -> None:
        """SLA tracking logic for coordinator_partner conversations."""
        from app.services import sla_service as _sla_service

        if sender.role != UserRole.partner:
            # Coordinator or internal staff responded — stop the clock
            await _sla_service.close_open_sla_for_entity(db, "conversation", entity_id)
            return

        # Partner sent a clarification — start SLA clock if not already running
        open_trackers = await _sla_service.get_open_sla_for_entity(db, "conversation", entity_id)
        if open_trackers:
            return  # Clock already ticking

        coordinator = await self._find_participant_by_role(
            db, conversation.participant_ids, UserRole.coordinator
        )
        if not coordinator:
            logger.warning(
                "No coordinator participant found in conversation %s; SLA clock not started",
                conversation.id,
            )
            return

        # Priority check: 1h if assignment sla_terms mentions "priority", else 4h
        sla_hours = 4
        if conversation.partner_assignment_id:
            from app.models.partner_assignment import PartnerAssignment

            assign_result = await db.execute(
                select(PartnerAssignment).where(
                    PartnerAssignment.id == conversation.partner_assignment_id
                )
            )
            assignment = assign_result.scalar_one_or_none()
            if assignment and assignment.sla_terms and "priority" in assignment.sla_terms.lower():
                sla_hours = 1

        await _sla_service.start_sla_clock(
            db,
            entity_type="conversation",
            entity_id=entity_id,
            communication_type=CommunicationType.partner_submission,
            assigned_to=coordinator.id,
            sla_hours=sla_hours,
        )

    async def _handle_rm_client_sla(
        self,
        db: AsyncSession,
        conversation: Conversation,
        entity_id: str,
        sender: User,
    ) -> None:
        """SLA tracking logic for rm_client conversations."""
        from app.services import sla_service as _sla_service

        if sender.role != UserRole.client:
            # RM or internal staff responded — stop the clock
            await _sla_service.close_open_sla_for_entity(db, "conversation", entity_id)
            return

        # Client sent a message — start SLA clock if not already running
        open_trackers = await _sla_service.get_open_sla_for_entity(db, "conversation", entity_id)
        if open_trackers:
            return  # Clock already ticking

        # Find the RM participant; fall back to assigned_rm_id on client profile
        rm = await self._find_participant_by_role(
            db, conversation.participant_ids, UserRole.relationship_manager
        )
        if not rm and conversation.client_id:
            from app.models.client_profile import ClientProfile

            client_result = await db.execute(
                select(ClientProfile).where(ClientProfile.id == conversation.client_id)
            )
            client_profile = client_result.scalar_one_or_none()
            if client_profile and client_profile.assigned_rm_id:
                rm_result = await db.execute(
                    select(User).where(User.id == client_profile.assigned_rm_id)
                )
                rm = rm_result.scalar_one_or_none()

        if not rm:
            logger.warning(
                "No RM found for rm_client conversation %s; SLA clock not started",
                conversation.id,
            )
            return

        # 2h for urgent/decision requests, 4h standard
        sla_hours = 4
        if conversation.title and any(
            kw in conversation.title.lower() for kw in ("urgent", "decision")
        ):
            sla_hours = 2

        await _sla_service.start_sla_clock(
            db,
            entity_type="conversation",
            entity_id=entity_id,
            communication_type=CommunicationType.client_inquiry,
            assigned_to=rm.id,
            sla_hours=sla_hours,
        )
