"""Annual capability review tracking for partner compliance."""

import uuid
from datetime import UTC, date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.partner import PartnerProfile
    from app.models.user import User


class CapabilityReview(Base):
    """Annual capability review for partner compliance verification."""

    __tablename__ = "capability_reviews"
    __table_args__ = (
        Index("ix_capability_reviews_partner_year", "partner_id", "review_year", unique=True),
        Index("ix_capability_reviews_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("partner_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    review_year: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    # pending, scheduled, in_progress, completed, overdue, waived
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    scheduled_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    capabilities_reviewed: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    certifications_reviewed: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    qualifications_reviewed: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    findings: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    # List of {type, description, severity, recommendation}
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendations: Mapped[str | None] = mapped_column(Text, nullable=True)
    reminder_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    partner: Mapped["PartnerProfile"] = relationship("PartnerProfile", backref="capability_reviews")
    reviewer: Mapped["User | None"] = relationship("User", foreign_keys=[reviewer_id])

    def __repr__(self) -> str:
        return (
            f"<CapabilityReview(id={self.id}, "
            f"partner_id={self.partner_id}, year={self.review_year})>"
        )
