"""Recent item model for tracking user's recently viewed items."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class RecentItem(Base, TimestampMixin):
    """Track user's recently viewed items (programs, clients, partners, documents)."""

    __tablename__ = "recent_items"
    __table_args__ = (
        Index("ix_recent_items_user_type", "user_id", "item_type"),
        Index("ix_recent_items_user_viewed", "user_id", "viewed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    # program, client, partner, document
    item_type: Mapped[str] = mapped_column(String(20), nullable=False)
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    # Denormalized for quick display
    item_title: Mapped[str] = mapped_column(String(255), nullable=False)
    # Optional secondary info
    item_subtitle: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    viewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Relationship
    user = relationship("User", backref="recent_items")

    def __repr__(self) -> str:
        return (
            f"<RecentItem(user_id={self.user_id}, "
            f"type={self.item_type}, item_id={self.item_id})>"
        )
