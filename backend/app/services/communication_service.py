"""Service for communication/message operations."""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.ws_connection import connection_manager
from app.models.communication import Communication
from app.models.conversation import Conversation
from app.schemas.communication import CommunicationCreate, SendMessageRequest
from app.services.communication_approval import CommunicationApprovalMixin
from app.services.communication_helpers import _attach_plaintext_body
from app.services.communication_sla_tracking import CommunicationSLAMixin
from app.services.crud_base import CRUDBase
from app.services.message_crypto import encrypt_body

logger = logging.getLogger(__name__)


class CommunicationService(
    CommunicationSLAMixin,
    CommunicationApprovalMixin,
    CRUDBase[Communication, CommunicationCreate, dict[str, Any]],
):
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

        # Phase 2.7 — encrypt body per conversation.  Messages with no
        # conversation_id (broadcast-style template sends) skip encryption.
        plaintext_body = data.body
        message_id = uuid.uuid4()
        ciphertext: bytes | None = None
        if data.conversation_id:
            ciphertext, key_id = encrypt_body(
                plaintext_body,
                conversation_id=data.conversation_id,
                sender_id=sender_id,
                message_id=message_id,
            )
            if conversation is not None and conversation.dek_key_id is None:
                conversation.dek_key_id = key_id

        # Create communication.  When encrypted, ``body`` is left NULL —
        # the plaintext lives only in ``body_ciphertext`` (and is re-populated
        # in-memory below for the response).
        communication = Communication(
            id=message_id,
            conversation_id=data.conversation_id,
            channel="in_portal",
            status="sent",
            sender_id=sender_id,
            body=None if ciphertext is not None else plaintext_body,
            body_ciphertext=ciphertext,
            attachment_ids=data.attachment_ids,
            sent_at=datetime.now(UTC),
        )
        db.add(communication)
        # Flush to assign identity / emit INSERT without committing, so the
        # Communication row and the SLA tracker row commit atomically.  If
        # _handle_sla_tracking raises, the not-yet-committed Communication
        # is rolled back with it — no orphaned messages without SLA rows.
        await db.flush()

        # Auto-create or close SLA tracker based on sender role and conversation type.
        # NOTE: the sla_service helpers (start_sla_clock / close_open_sla_for_entity)
        # call db.commit() internally, which commits the pending Communication too.
        # No try/except here — a failure must abort the message send.
        if conversation is not None:
            await self._handle_sla_tracking(db, conversation, sender_id)

        # Ensure the Communication is committed even on SLA early-return paths
        # (e.g. conversation is None, sender not found, already-open tracker).
        # A commit with no pending work is a safe no-op on SQLAlchemy async.
        await db.commit()
        await db.refresh(communication)

        # Audit trail — best-effort.  log_communication_event commits on its own,
        # so a failure here cannot roll back the already-committed message.
        try:
            from app.services.communication_audit_service import log_communication_event

            await log_communication_event(
                db,
                communication_id=communication.id,
                conversation_id=data.conversation_id,
                action="message_sent",
                actor_id=sender_id,
                details={"channel": "in_portal", "has_attachments": bool(data.attachment_ids)},
            )
        except Exception:
            logger.exception("Failed to log audit event for communication %s", communication.id)

        # Populate plaintext body in-memory for the response and broadcast.
        # Detach from the session first so this never flushes back to the DB.
        if ciphertext is not None:
            db.expunge(communication)
            communication.body = plaintext_body

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

        # Phase 2.7 — decrypt ciphertext bodies into in-memory ``body`` for
        # the response.  Detach each row from the session so the mutation
        # cannot leak back to the DB on a later flush.
        for msg in messages:
            _attach_plaintext_body(db, msg)

        return messages, total

    async def mark_read(
        self,
        db: AsyncSession,
        communication_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Communication | None:
        """Mark a single communication as read by user."""
        communication = await self.get(db, communication_id)
        if not communication:
            return None

        if communication.read_receipts is None:
            communication.read_receipts = {}

        communication.read_receipts[str(user_id)] = {"read_at": datetime.now(UTC).isoformat()}
        await db.commit()
        await db.refresh(communication)

        # Audit trail
        try:
            from app.services.communication_audit_service import log_communication_event

            await log_communication_event(
                db,
                communication_id=communication_id,
                conversation_id=communication.conversation_id,
                action="message_read",
                actor_id=user_id,
                details={},
            )
        except Exception:
            logger.exception("Failed to log audit event for communication %s", communication_id)

        return communication

    async def mark_messages_read(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> int:
        """Mark all unread messages in a conversation as read for user.

        Only updates messages not sent by the user and not already read.
        Returns the number of messages updated.
        """
        read_time = datetime.now(UTC).isoformat()
        stmt = text(
            """
            UPDATE communications
            SET read_receipts = (
                COALESCE(read_receipts::jsonb, '{}'::jsonb)
                || jsonb_build_object(
                    :uid,
                    jsonb_build_object('read_at', :ts)
                )
            )::json
            WHERE conversation_id = :cid
              AND (sender_id IS NULL OR sender_id <> :sender_uid)
              AND NOT (COALESCE(read_receipts::jsonb, '{}'::jsonb) ? :uid)
            """
        )
        result = await db.execute(
            stmt,
            {
                "uid": str(user_id),
                "sender_uid": str(user_id),
                "ts": read_time,
                "cid": str(conversation_id),
            },
        )
        updated = int(result.rowcount or 0)  # type: ignore[attr-defined]
        if updated:
            await db.commit()
        return updated

    async def get_unread_counts_for_conversations(
        self,
        db: AsyncSession,
        conversation_ids: list[uuid.UUID],
        user_id: uuid.UUID,
    ) -> dict[str, int]:
        """Return unread message count per conversation for a user.

        A message is unread if the user_id is absent from its read_receipts
        and the message was not sent by the user themselves.
        """
        if not conversation_ids:
            return {}

        result = await db.execute(
            select(Communication).where(
                Communication.conversation_id.in_(conversation_ids),
                Communication.sender_id != user_id,
            )
        )
        messages = result.scalars().all()

        counts: dict[str, int] = {str(cid): 0 for cid in conversation_ids}
        user_id_str = str(user_id)

        for msg in messages:
            if msg.conversation_id and (
                msg.read_receipts is None or user_id_str not in msg.read_receipts
            ):
                conv_key = str(msg.conversation_id)
                counts[conv_key] = counts.get(conv_key, 0) + 1

        return counts

    async def get_unread_count(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Get unread message count grouped by conversation."""
        conv_result = await db.execute(
            select(Conversation).where(Conversation.participant_ids.contains([user_id]))
        )
        conversations = conv_result.scalars().all()
        conv_ids = [c.id for c in conversations]

        counts = await self.get_unread_counts_for_conversations(db, conv_ids, user_id)
        total = sum(counts.values())

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
