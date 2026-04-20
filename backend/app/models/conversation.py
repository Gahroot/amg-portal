"""Conversation model for threaded messaging."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import ConversationType


class Conversation(Base, TimestampMixin):
    """Threaded conversation between users."""

    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_type: Mapped[ConversationType] = mapped_column(
        String(50), nullable=False, default=ConversationType.rm_client
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("client_profiles.id", ondelete="SET NULL"), nullable=True
    )
    partner_assignment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("partner_assignments.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    participant_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=False, default=list
    )
    last_activity_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Phase 2.7 — per-conversation DEK.  Each conversation has a DEK that is
    # HKDF-derived from the tenant KEK (``crypto.derive_dek(kek, conv_id, "msg")``).
    # ``dek_key_id`` is populated on first message; ``dek_rotated_at`` is
    # bumped when membership changes or an operator schedules rotation.
    dek_key_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dek_rotated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    client = relationship("ClientProfile", foreign_keys=[client_id])
    partner_assignment = relationship("PartnerAssignment", foreign_keys=[partner_assignment_id])
    communications = relationship(
        "Communication", back_populates="conversation", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Conversation(id={self.id}, type={self.conversation_type})>"
