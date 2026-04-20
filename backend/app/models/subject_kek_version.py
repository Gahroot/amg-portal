"""Per-subject KEK version for crypto-shred erasure (Phase 2.6 / 2.14).

Every encrypted subject (a client, a program, a conversation, an IR case)
has a ``subject_kek_versions`` row.  Normal operations use the ``active``
version; a shred bumps ``destroyed_at`` on the active row and flips
``active=False``, making every ciphertext bound to that version
permanently unrecoverable.

DEK derivation incorporates the version into the HKDF ``info`` string, so
bumping the version is equivalent to destroying the subject's DEK — ENISA's
recognised crypto-shred pattern for retention-obligated data.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class SubjectKEKVersion(Base, TimestampMixin):
    __tablename__ = "subject_kek_versions"
    __table_args__ = (
        UniqueConstraint("subject_type", "subject_id", "version", name="uq_subject_kek_version"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject_type: Mapped[str] = mapped_column(String(50), nullable=False)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    destroyed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    destroyed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
