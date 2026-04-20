"""Break-glass compliance access request (Phase 2.8).

Supervised-access workflow for encrypted, retention-sensitive resources
(conversation bodies, sealed documents).  Two-person rule: the requester
proposes, the approver (compliance or MD) approves.  On approval the
requester receives a short-lived scoped ``break_glass`` JWT; every
subsequent use of the token emits an audit-chain row.

Legal posture: break-glass proves supervised retention is possible without
being a back door — the approval, the consumption, and the justification
are all tamper-evident audit-chain entries.  Clients disclose this in T&Cs
as part of ``supervised, retained, encrypted at rest, not private from the
firm``.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class BreakGlassRequest(Base, TimestampMixin):
    __tablename__ = "break_glass_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    # Comma-separated list of action scopes the token will cover, e.g.
    # "conversation_read,conversation_export".
    action_scope: Mapped[str] = mapped_column(String(500), nullable=False)
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", server_default="pending"
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])
