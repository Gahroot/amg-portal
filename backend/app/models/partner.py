import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import PartnerStatus


class PartnerProfile(Base, TimestampMixin):
    __tablename__ = "partner_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=True)
    firm_name = Column(String(255), nullable=False)
    contact_name = Column(String(255), nullable=False)
    contact_email = Column(String(255), nullable=False)
    contact_phone = Column(String(50), nullable=True)
    capabilities = Column(JSON, default=list)
    geographies = Column(JSON, default=list)
    availability_status = Column(String(50), default="available")
    performance_rating = Column(Numeric(3, 2), nullable=True)
    total_assignments = Column(Integer, default=0)
    completed_assignments = Column(Integer, default=0)
    max_concurrent_assignments = Column(Integer, default=5, nullable=False)
    compliance_doc_url = Column(String(500), nullable=True)
    compliance_verified = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    status: Mapped[PartnerStatus] = mapped_column(
        String(20), nullable=False, default=PartnerStatus.pending
    )
    last_refreshed_at = Column(DateTime(timezone=True), nullable=True)
    refresh_due_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

# Relationships
    user = relationship("User", foreign_keys=[user_id], backref="partner_profile")
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


class PartnerBlockedDate(Base, TimestampMixin):
    """Dates a partner has marked as unavailable."""

    __tablename__ = "partner_blocked_dates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(
        UUID(as_uuid=True), ForeignKey("partner_profiles.id"), nullable=False, index=True
    )
    blocked_date = Column(Date, nullable=False)
    reason = Column(String(255), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Relationships
    partner = relationship("PartnerProfile", back_populates="blocked_dates")
    creator = relationship("User", foreign_keys=[created_by])
