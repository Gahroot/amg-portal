import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Index, LargeBinary, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import AuditAction


class AuditLog(Base):
    """Append-only audit log for compliance tracking.

    Rows carry a tamper-evident hash chain (Phase 1.12):

    * ``prev_hash`` — row_hash of the previous entry in insert order
      (NULL for the chain genesis row).
    * ``row_hash`` — SHA-256 over the canonical JSON encoding of this row
      concatenated with ``prev_hash``.
    * ``hmac`` — HMAC-SHA256(daily_key, row_hash).
    * ``day_bucket`` — UTC date of the row, the Merkle-tree grouping key for
      the daily checkpoint.
    """

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    action: Mapped[AuditAction] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False)
    before_state: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    after_state: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Hash-chain columns (Phase 1.12)
    prev_hash: Mapped[bytes | None] = mapped_column(LargeBinary(32), nullable=True)
    row_hash: Mapped[bytes] = mapped_column(LargeBinary(32), nullable=False)
    hmac: Mapped[bytes] = mapped_column(LargeBinary(32), nullable=False)
    day_bucket: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    __table_args__ = (
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
        Index("ix_audit_logs_created_at", "created_at"),
    )
