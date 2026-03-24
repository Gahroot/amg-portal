"""Support chat models for in-app live chat with support team."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class SupportConversation(Base, TimestampMixin):
    """Support chat conversation between a user and support agents."""

    __tablename__ = "support_conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="open"
    )  # open, waiting, in_progress, closed
    priority: Mapped[str] = mapped_column(
        String(50), nullable=False, default="normal"
    )  # low, normal, high, urgent
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    assigned_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_message_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    satisfaction_rating: Mapped[int | None] = mapped_column(nullable=True)  # 1-5
    satisfaction_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    assigned_agent = relationship("User", foreign_keys=[assigned_agent_id])
    closer = relationship("User", foreign_keys=[closed_by])
    messages = relationship(
        "SupportMessage", back_populates="conversation", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<SupportConversation(id={self.id}, status={self.status})>"


class SupportMessage(Base, TimestampMixin):
    """Individual message in a support conversation."""

    __tablename__ = "support_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("support_conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    sender_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # user, agent, system
    body: Mapped[str] = mapped_column(Text, nullable=False)
    attachment_ids: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    is_internal: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )  # Internal notes not visible to user
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    read_by_user_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    read_by_agent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    conversation = relationship("SupportConversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])

    def __repr__(self) -> str:
        return f"<SupportMessage(id={self.id}, sender_type={self.sender_type})>"


class SupportAgentStatus(Base, TimestampMixin):
    """Support agent availability status."""

    __tablename__ = "support_agent_statuses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    is_online: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="offline"
    )  # online, away, busy, offline
    active_conversations: Mapped[int] = mapped_column(nullable=False, default=0)
    max_conversations: Mapped[int] = mapped_column(nullable=False, default=5)
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<SupportAgentStatus(user_id={self.user_id}, status={self.status})>"


class SupportOfflineMessage(Base, TimestampMixin):
    """Messages left when support is offline."""

    __tablename__ = "support_offline_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    processed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    processed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("support_conversations.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    processor = relationship("User", foreign_keys=[processed_by])
    created_conversation = relationship(
        "SupportConversation", foreign_keys=[created_conversation_id]
    )

    def __repr__(self) -> str:
        return f"<SupportOfflineMessage(id={self.id}, processed={self.processed})>"
