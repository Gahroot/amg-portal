"""Partner governance model — tracks governance actions (warning, probation, suspension, etc.)."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PartnerGovernance(Base):
    """Governance action record for a partner.

    Tracks formal governance decisions (warning, probation, suspension,
    termination, reinstatement) tied to composite partner performance scores.
    """

    __tablename__ = "partner_governance"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    partner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("partner_profiles.id"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(30), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)

    effective_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    expiry_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    issued_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    partner = relationship("PartnerProfile", foreign_keys=[partner_id])
    issuer = relationship("User", foreign_keys=[issued_by])

    __table_args__ = (Index("ix_partner_governance_partner_id", "partner_id"),)

    def __repr__(self) -> str:
        return f"<PartnerGovernance(id={self.id}, action={self.action})>"
