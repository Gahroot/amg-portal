"""One-time redemption tokens for large-file downloads (Phase 2.5)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class DownloadToken(Base, TimestampMixin):
    """Single-use token that redeems to a short-lived presigned URL.

    Tokens are issued by the document proxy-through route when a caller is
    authorised for a large file (> ``DOWNLOAD_PROXY_THRESHOLD_BYTES``).  The
    client hits ``/api/v1/files/download/{token}`` and the server issues a
    60-120 s presigned URL while marking the token redeemed.  Every redemption
    writes an audit-chain row.
    """

    __tablename__ = "download_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    issued_to: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    document = relationship("Document", foreign_keys=[document_id])
    issuer = relationship("User", foreign_keys=[issued_to])
