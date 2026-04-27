"""WebAuthn / FIDO2 credential storage (Phase 2.9).

One row per registered passkey or security key.  ``public_key`` is the
CBOR-encoded COSE key as returned by py_webauthn.  ``credential_id`` is the
raw binary ID used to look up the credential on authentication.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class WebAuthnCredential(Base, TimestampMixin):
    __tablename__ = "webauthn_credentials"
    __table_args__ = (
        UniqueConstraint("credential_id", name="uq_webauthn_credentials_credential_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    credential_id: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    public_key: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    sign_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    transports: Mapped[str | None] = mapped_column(String(200), nullable=True)
    aaguid: Mapped[str | None] = mapped_column(String(36), nullable=True)
    nickname: Mapped[str | None] = mapped_column(String(120), nullable=True)
    backup_state: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User")
