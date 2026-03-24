"""Notification preference model for user notification settings."""

import uuid
from datetime import time
from typing import Any

from sqlalchemy import JSON, Boolean, ForeignKey, String, Time
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import DigestFrequency


class NotificationPreference(Base, TimestampMixin):
    """User preferences for notifications and digests."""

    __tablename__ = "notification_preferences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    digest_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    digest_frequency: Mapped[DigestFrequency] = mapped_column(
        String(20), nullable=False, default=DigestFrequency.daily
    )
    # Per-type preferences: {"communication": "immediate", "system": "daily"}
    notification_type_preferences: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True
    )
    # Channel preferences: {"in_portal": true, "email": true, "push": true}
    channel_preferences: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    # Granular category × channel preferences:
    # {"sla_warning": {"push": true, "email": true, "in_app": true}, ...}
    # When set, these override the global channel_preferences for that category.
    granular_preferences: Mapped[dict[str, dict[str, bool]] | None] = mapped_column(
        JSON, nullable=True
    )
    # Quiet hours settings
    quiet_hours_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    quiet_hours_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    quiet_hours_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, default="UTC")
    # Grouping preference for notification display: "type", "entity", "time", or None
    grouping_mode: Mapped[str | None] = mapped_column(String(20), nullable=True, default="type")

    # Milestone reminder preferences
    # Days before due date to send reminders, e.g. [7, 3, 1]
    milestone_reminder_days: Mapped[list[int] | None] = mapped_column(
        JSONB, nullable=True, default=lambda: [7, 1], server_default="[7, 1]"
    )
    # Channels to use for milestone reminders: ["email", "in_app", "push"]
    milestone_reminder_channels: Mapped[list[str] | None] = mapped_column(
        JSONB,
        nullable=True,
        default=lambda: ["email", "in_app"],
        server_default='["email", "in_app"]',
    )
    # Per-program reminder overrides: {program_id: {"days": [3, 1], "channels": ["email"]}}
    milestone_reminder_program_overrides: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True
    )

    def __repr__(self) -> str:
        return f"<NotificationPreference(user_id={self.user_id}, digest={self.digest_frequency})>"
