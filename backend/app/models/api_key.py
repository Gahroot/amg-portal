"""API Key model for programmatic API access."""

import secrets
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


def _hash_key(key: str) -> str:
    """Hash an API key using SHA256 for storage."""
    import hashlib

    return hashlib.sha256(key.encode()).hexdigest()


def generate_api_key() -> tuple[str, str]:
    """Generate a secure API key and return (plain_key, key_hash).

    The plain key is shown ONCE to the user and never stored.
    The key_hash is stored in the database for verification.
    """
    # Generate a key with a recognizable prefix for easy identification
    raw_key = secrets.token_urlsafe(32)
    plain_key = f"amg_{raw_key}"
    key_hash = _hash_key(plain_key)
    return plain_key, key_hash


class APIKey(Base, TimestampMixin):
    """API Key for programmatic API access.

    API keys allow partners and clients to authenticate API requests
    without using their login credentials. Keys are hashed in the database
    and the original key is only shown once when created.
    """

    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    key_prefix: Mapped[str] = mapped_column(String(12), nullable=False)
    scopes: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    rate_limit: Mapped[int | None] = mapped_column(
        # Requests per minute. NULL means use default (60).
        # Stored as int for easy comparison with request counts.
        nullable=True,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="api_keys")

    __table_args__ = (Index("ix_api_keys_user_active", "user_id", "is_active"),)

    @classmethod
    def create(
        cls,
        user_id: uuid.UUID,
        name: str,
        scopes: list[str],
        expires_at: datetime | None = None,
        rate_limit: int | None = None,
    ) -> tuple["APIKey", str]:
        """Create a new API key.

        Returns:
            Tuple of (APIKey instance, plain_key string).
            The plain_key must be shown to the user immediately and will not be retrievable again.
        """
        plain_key, key_hash = generate_api_key()
        key_prefix = plain_key[:12]  # Store prefix for identification (e.g., "amg_abc12345")

        api_key = cls(
            user_id=user_id,
            name=name,
            key_hash=key_hash,
            key_prefix=key_prefix,
            scopes=scopes,
            expires_at=expires_at,
            rate_limit=rate_limit,
        )
        return api_key, plain_key

    def verify_key(self, plain_key: str) -> bool:
        """Verify if a plain key matches this API key's hash."""
        if not self.is_active:
            return False
        if self.expires_at and datetime.now(UTC) > self.expires_at:
            return False
        return _hash_key(plain_key) == self.key_hash

    def revoke(self, revoked_by: uuid.UUID) -> None:
        """Revoke this API key."""
        self.is_active = False
        self.revoked_at = datetime.now(UTC)
        self.revoked_by = revoked_by

    def record_usage(self) -> None:
        """Record that this API key was used."""
        self.last_used_at = datetime.now(UTC)

    def has_scope(self, scope: str) -> bool:
        """Check if this API key has a specific scope."""
        return scope in self.scopes or "*" in self.scopes

    @property
    def display_key(self) -> str:
        """Return a display-friendly version of the key (masked)."""
        return f"{self.key_prefix}...****"

    def __repr__(self) -> str:
        return f"<APIKey(id={self.id}, name={self.name}, user_id={self.user_id})>"
