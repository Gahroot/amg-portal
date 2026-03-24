"""Sync queue for offline-first operations."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class SyncQueueItem(Base, TimestampMixin):
    """Queue for offline sync operations.

    When a device makes changes while offline, they are queued here
    and processed when the device comes back online. This enables
    offline-first functionality with reliable sync.
    """

    __tablename__ = "sync_queue"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Device that created this sync item
    device_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # Type of entity being synced: preference, read_status, etc.
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # Entity ID (nullable for global preferences)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    # Action: mark_read, update_preference, etc.
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    # Payload data for the action
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    # When this item was created on the client
    client_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    # When this item was successfully synced (null if pending)
    synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Error message if sync failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Number of sync attempts
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Index for efficient pending item queries
    __table_args__ = (
        Index(
            "ix_sync_queue_pending",
            "user_id",
            "synced_at",
            postgresql_where="synced_at IS NULL",
        ),
    )

    def __repr__(self) -> str:
        status = "pending" if self.synced_at is None else "synced"
        return f"<SyncQueueItem({self.action} {self.entity_type}, {status})>"

    def mark_synced(self) -> None:
        """Mark this item as successfully synced."""
        self.synced_at = datetime.now(UTC)

    def increment_retry(self, error: str | None = None) -> None:
        """Increment retry count and optionally set error message."""
        self.retry_count = self.retry_count + 1
        if error:
            self.error_message = error
