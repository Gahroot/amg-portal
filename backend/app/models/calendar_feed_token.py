"""Calendar feed token model for secure iCal subscriptions."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class CalendarFeedToken(Base, TimestampMixin):
    """Token for authenticating calendar feed subscriptions.

    Each user can have one active token at a time for their calendar feed.
    The token is used as a query parameter in the iCal subscription URL.
    """

    __tablename__ = "calendar_feed_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, default="Calendar Feed")
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    last_accessed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="calendar_feed_tokens")

    def __repr__(self) -> str:
        return f"<CalendarFeedToken(id={self.id}, user_id={self.user_id}, active={self.is_active})>"
