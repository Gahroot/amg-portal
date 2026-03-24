"""Performance notice model — formal notices for SLA breaches or quality issues."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class PerformanceNotice(Base, TimestampMixin):
    """Formal performance notice issued by a Managing Director to a partner.

    Triggered by SLA breaches or quality issues per Section 05 of the design spec.
    Creates a formal record and updates partner rating context.
    """

    __tablename__ = "performance_notices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    partner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("partner_profiles.id"), nullable=False, index=True
    )
    program_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id"), nullable=True, index=True
    )
    issued_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # "sla_breach" | "quality_issue"
    notice_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # "warning" | "formal_notice" | "final_notice"
    severity: Mapped[str] = mapped_column(String(50), nullable=False, default="formal_notice")

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    required_action: Mapped[str | None] = mapped_column(Text, nullable=True)

    # "open" | "acknowledged"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


    partner = relationship("PartnerProfile", foreign_keys=[partner_id])
    program = relationship("Program", foreign_keys=[program_id])
    issuer = relationship("User", foreign_keys=[issued_by])
