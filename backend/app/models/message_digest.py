"""Message digest tracking model."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import DigestFrequency


class MessageDigestPreference(Base, TimestampMixin):
    """Per-user digest preferences for conversation messages.

    This supplements the existing NotificationPreference model with
    message-specific digest tracking (last sent timestamp).
    """

    __tablename__ = "message_digest_preferences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    digest_frequency: Mapped[DigestFrequency] = mapped_column(
        String(20), nullable=False, default=DigestFrequency.daily
    )
    last_digest_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return (
            f"<MessageDigestPreference(user_id={self.user_id}, "
            f"frequency={self.digest_frequency})>"
        )
