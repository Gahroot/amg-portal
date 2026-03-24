"""Document sharing model for secure, time-limited access by external recipients."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class DocumentShare(Base, TimestampMixin):
    """A token-protected share of a document sent to an external recipient."""

    __tablename__ = "document_shares"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shared_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    shared_with_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    # access_level: view or download
    access_level: Mapped[str] = mapped_column(String(20), nullable=False, default="view")
    # Secure token embedded in the share URL
    share_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    # OTP for email verification (hashed)
    verification_code_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    verification_code_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    access_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    # Relationships
    document = relationship("Document", foreign_keys=[document_id])
    sharer = relationship("User", foreign_keys=[shared_by])
    revoker = relationship("User", foreign_keys=[revoked_by])

    def __repr__(self) -> str:
        return f"<DocumentShare(id={self.id}, doc={self.document_id}, to={self.shared_with_email})>"
