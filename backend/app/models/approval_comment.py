"""Approval comment model for threaded comment history on approval items."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ApprovalComment(Base):
    """Threaded comment on an approval item.

    Uses entity_type / entity_id to allow comments on any approval
    entity (ProgramApproval, client profile review, etc.).
    """

    __tablename__ = "approval_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Generic entity reference
    entity_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # e.g. "program_approval", "client_profile"
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    # Threading: parent_id points to another ApprovalComment for replies
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("approval_comments.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Visibility: internal comments are only shown to internal staff
    is_internal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # @mention tracking — list of user IDs mentioned in the comment body
    mentioned_user_ids: Mapped[list[str]] = mapped_column(
        ARRAY(UUID(as_uuid=False)), nullable=False, default=list
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    author = relationship("User", foreign_keys=[author_id])
    replies = relationship(
        "ApprovalComment",
        back_populates="parent",
        cascade="all, delete-orphan",
        foreign_keys=[parent_id],
    )
    parent = relationship(
        "ApprovalComment",
        back_populates="replies",
        remote_side="ApprovalComment.id",
        foreign_keys=[parent_id],
    )

    def __repr__(self) -> str:
        return (
            f"<ApprovalComment(id={self.id}, entity_type={self.entity_type}, "
            f"entity_id={self.entity_id})>"
        )
