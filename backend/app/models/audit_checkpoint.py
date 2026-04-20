"""Daily audit-log Merkle-tree checkpoint (Phase 1.13).

One row per UTC day — the Merkle root over every ``audit_logs.row_hash`` for
that day, Ed25519-signed with the key version in env
``AUDIT_ED25519_PRIVATE_V1``.  An RFC-3161 timestamp token from FreeTSA anchors
the signature to a third-party time proof; ``tsa_error`` records the failure
reason when FreeTSA is unreachable (we still persist the signature).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, LargeBinary, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuditCheckpoint(Base):
    __tablename__ = "audit_checkpoints"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    day: Mapped[date] = mapped_column(Date, nullable=False, unique=True, index=True)
    merkle_root: Mapped[bytes] = mapped_column(LargeBinary(32), nullable=False)
    signature: Mapped[bytes] = mapped_column(LargeBinary(64), nullable=False)
    tsa_token: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    tsa_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
