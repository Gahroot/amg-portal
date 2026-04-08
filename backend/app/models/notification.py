"""Notification model for in-portal notifications."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import NotificationType


class Notification(Base):
    """In-portal notification for users."""

    __tablename__ = "notifications"
    __table_args__ = (
        # Composite index for the dominant query pattern: fetch a user's unread notifications
        Index("ix_notifications_user_id_is_read", "user_id", "is_read"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    notification_type: Mapped[NotificationType] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    action_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    action_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # e.g., "program", "deliverable"
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # low, normal, high, urgent
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email_delivered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Quiet hours queuing - track pending push/email deliveries
    push_queued: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    email_queued: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    # Grouping key for bundling related notifications
    # Format: "{entity_type}:{entity_id}" or "{notification_type}" or custom
    group_key: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    # Snooze fields for notification snoozing feature
    snoozed_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    snooze_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    def __repr__(self) -> str:
        return (
            f"<Notification(id={self.id}, type={self.notification_type}, user_id={self.user_id})>"
        )
