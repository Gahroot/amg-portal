"""Read status tracking for various entities across devices."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ReadStatus(Base):
    """Track read/unread status for various entities.

    This model enables tracking read status for programs, documents,
    deliverables, notifications, etc. across multiple devices.
    """

    __tablename__ = "read_statuses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Type of entity: program, document, deliverable, notification, etc.
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # ID of the entity being tracked
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    # Read status
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # When the entity was marked as read/unread
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Which device made the change (for sync tracking)
    device_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # When this record was created/last updated
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Composite index for efficient queries
    __table_args__ = (
        Index(
            "ix_read_statuses_user_entity",
            "user_id",
            "entity_type",
            "entity_id",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return f"<ReadStatus({self.user_id}, {self.entity_type}:{self.entity_id})>"
