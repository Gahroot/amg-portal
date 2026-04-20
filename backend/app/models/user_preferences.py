"""Unified user preferences model for storing UI and sync preferences."""

import uuid
from typing import Any

from sqlalchemy import Boolean, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class UserPreferences(Base, TimestampMixin):
    """Unified user preferences for UI, notifications, and sync.

    This model consolidates various user preference settings and provides
    version tracking for conflict resolution in multi-device sync.
    """

    __tablename__ = "user_preferences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    # UI preferences stored as JSON
    # Example: {"theme": "dark", "sidebar_collapsed": false, "density": "comfortable"}
    ui_preferences: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    # Version number for optimistic locking during sync
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Whether to sync preferences across devices
    sync_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    # Note: notification_preferences and dashboard_config are separate tables
    # linked via user_id, not direct foreign keys

    def __repr__(self) -> str:
        return f"<UserPreferences(user_id={self.user_id}, version={self.version})>"
