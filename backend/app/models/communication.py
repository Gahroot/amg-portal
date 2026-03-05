"""Communication model for individual messages."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Communication(Base):
    """Individual message or communication record."""

    __tablename__ = "communications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True
    )
    channel: Mapped[str] = mapped_column(String(50), nullable=False, default="in_portal")
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    sender_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # Recipients: {"user_id": {"role": "to/cc/bcc"}}
    recipients: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    attachment_ids: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)  # Document IDs
    # Context fields for filtering/reporting
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("client_profiles.id", ondelete="SET NULL"), nullable=True
    )
    program_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id", ondelete="SET NULL"), nullable=True
    )
    partner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("partner_profiles.id", ondelete="SET NULL"), nullable=True
    )
    # Read receipts per user: {"user_id": {"read_at": "2024-01-01T00:00:00Z"}}
    read_receipts: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    conversation = relationship("Conversation", back_populates="communications")
    sender = relationship("User", foreign_keys=[sender_id])
    client = relationship("ClientProfile", foreign_keys=[client_id])
    program = relationship("Program", foreign_keys=[program_id])
    partner = relationship("PartnerProfile", foreign_keys=[partner_id])

    def __repr__(self) -> str:
        return f"<Communication(id={self.id}, channel={self.channel}, status={self.status})>"
