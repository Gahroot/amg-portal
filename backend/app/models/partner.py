import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import PartnerStatus


class PartnerProfile(Base, TimestampMixin):
    __tablename__ = "partner_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=True
    )
    firm_name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    capabilities: Mapped[list[str] | None] = mapped_column(JSON, default=list)
    geographies: Mapped[list[str] | None] = mapped_column(JSON, default=list)
    availability_status: Mapped[str | None] = mapped_column(String(50), default="available")
    performance_rating: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)
    total_assignments: Mapped[int | None] = mapped_column(Integer, default=0)
    completed_assignments: Mapped[int | None] = mapped_column(Integer, default=0)
    max_concurrent_assignments: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    compliance_doc_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    compliance_verified: Mapped[bool | None] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[PartnerStatus] = mapped_column(
        String(20), nullable=False, default=PartnerStatus.pending
    )
    last_refreshed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    refresh_due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="partner_profile")
    creator = relationship("User", foreign_keys=[created_by])
    assignments = relationship(
        "PartnerAssignment",
        back_populates="partner",
        cascade="all, delete-orphan",
    )
    blocked_dates = relationship(
        "PartnerBlockedDate",
        back_populates="partner",
        cascade="all, delete-orphan",
    )
    blockers = relationship(
        "PartnerBlocker",
        back_populates="partner",
        cascade="all, delete-orphan",
        order_by="PartnerBlocker.start_date",
    )
    capabilities_detail = relationship(
        "PartnerCapability",
        back_populates="partner",
    )
    qualifications_detail = relationship(
        "PartnerQualification",
        back_populates="partner",
    )
    certifications_detail = relationship(
        "PartnerCertification",
        back_populates="partner",
    )
    onboarding_detail = relationship(
        "PartnerOnboarding",
        back_populates="partner",
        uselist=False,
    )


class PartnerBlockedDate(Base, TimestampMixin):
    """Dates a partner has marked as unavailable."""

    __tablename__ = "partner_blocked_dates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("partner_profiles.id"), nullable=False, index=True
    )
    blocked_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # Relationships
    partner = relationship("PartnerProfile", back_populates="blocked_dates")
    creator = relationship("User", foreign_keys=[created_by])
