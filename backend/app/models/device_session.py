"""Device session tracking for multi-device sync."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class DeviceSession(Base, TimestampMixin):
    """Track active device sessions for multi-device sync.

    This model keeps track of all devices a user is logged into,
    enabling device-specific sync and device management features.
    """

    __tablename__ = "device_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Unique device identifier (generated client-side)
    device_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # Device type: web, ios, android
    device_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # Human-readable device name (optional)
    device_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Last time this device was seen
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    # Whether the device is currently active
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # User agent string for web devices
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # App version
    app_version: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Composite index for user+device lookups
    __table_args__ = (
        Index("ix_device_sessions_user_device", "user_id", "device_id", unique=True),
    )

    def __repr__(self) -> str:
        return f"<DeviceSession({self.user_id}, {self.device_type}:{self.device_id})>"

    def update_last_seen(self) -> None:
        """Update the last_seen_at timestamp."""
        self.last_seen_at = datetime.now(UTC)
