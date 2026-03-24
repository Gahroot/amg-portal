"""PartnerThreshold model — configurable performance thresholds per partner or global."""

import uuid

from sqlalchemy import Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class PartnerThreshold(Base, TimestampMixin):
    """Performance alert thresholds for a partner.

    If partner_id is NULL the record is the global default used for all partners
    that don't have a partner-specific override.
    """

    __tablename__ = "partner_thresholds"
    __table_args__ = (
        UniqueConstraint("partner_id", name="uq_partner_threshold_partner_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # NULL → global default; non-NULL → partner-specific override
    partner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("partner_profiles.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Thresholds
    sla_compliance_threshold: Mapped[float] = mapped_column(
        Float, nullable=False, default=90.0,
        comment="Minimum SLA compliance % before alert fires (0–100)",
    )
    quality_score_threshold: Mapped[float] = mapped_column(
        Float, nullable=False, default=3.0,
        comment="Minimum average quality score before alert fires (1–5)",
    )
    overall_score_threshold: Mapped[float] = mapped_column(
        Float, nullable=False, default=3.0,
        comment="Minimum average overall score before alert fires (1–5)",
    )
    trend_window_weeks: Mapped[int] = mapped_column(
        Integer, nullable=False, default=4,
        comment="Number of consecutive declining weeks that trigger a trend alert",
    )

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # Relationships
    partner = relationship("PartnerProfile", foreign_keys=[partner_id])
    creator = relationship("User", foreign_keys=[created_by])
