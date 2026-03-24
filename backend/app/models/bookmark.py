"""Bookmark model for pinning frequently accessed programs, clients, and partners."""

import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Bookmark(Base, TimestampMixin):
    """A user's bookmarked (pinned) entity: program, client, or partner."""

    __tablename__ = "bookmarks"
    __table_args__ = (
        UniqueConstraint("user_id", "entity_type", "entity_id", name="uq_bookmark"),
        Index("ix_bookmarks_user_type", "user_id", "entity_type"),
        Index("ix_bookmarks_user_order", "user_id", "display_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    # "program" | "client" | "partner"
    entity_type: Mapped[str] = mapped_column(String(20), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    # Denormalized for quick display without joins
    entity_title: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_subtitle: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Lower number = shown first
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    user = relationship("User", backref="bookmarks")

    def __repr__(self) -> str:
        return (
            f"<Bookmark(user_id={self.user_id}, "
            f"type={self.entity_type}, entity_id={self.entity_id})>"
        )
