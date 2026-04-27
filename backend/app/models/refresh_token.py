"""Refresh token storage for rotation and revocation."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class RefreshToken(Base, TimestampMixin):
    """Stores refresh token hashes for rotation and reuse detection."""

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    jti: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)
    family_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    is_revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Sliding idle timeout (Phase 2.12).  Updated on every refresh; if
    # ``now - last_active_at`` exceeds ``REFRESH_TOKEN_IDLE_TIMEOUT_MINUTES``
    # the refresh handler rejects and the family is revoked.
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("ix_refresh_tokens_family_revoked", "family_id", "is_revoked"),)

    def __repr__(self) -> str:
        return f"<RefreshToken(id={self.id}, user_id={self.user_id}, revoked={self.is_revoked})>"
