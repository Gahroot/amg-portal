"""Notification preference model for user notification settings."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NotificationPreference(Base):
    """User preferences for notifications and digests."""

    __tablename__ = "notification_preferences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    digest_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    digest_frequency: Mapped[str] = mapped_column(String(20), nullable=False, default="daily")
    # Per-type preferences: {"communication": "immediate", "system": "daily"}
    notification_type_preferences: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True
    )
    # Channel preferences: {"in_portal": true, "email": true}
    channel_preferences: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<NotificationPreference(user_id={self.user_id}, digest={self.digest_frequency})>"
