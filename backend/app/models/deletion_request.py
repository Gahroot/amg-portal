"""Deletion request model for two-person authorization workflow."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DeletionRequest(Base):
    """Two-person authorization record for permanent deletions.

    No entity is permanently erased without a second authorized user
    approving the request. This model captures the full audit trail.
    """

    __tablename__ = "deletion_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Target entity
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False)

    # Request side
    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=False
    )
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)

    # Resolution side
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Lifecycle
    # pending → approved (then executed) | rejected | expired
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])

    def __repr__(self) -> str:
        return (
            f"<DeletionRequest(id={self.id}, entity={self.entity_type}/{self.entity_id},"
            f" status={self.status})>"
        )
