"""Partner capability matrix, qualifications, certifications, and onboarding models."""

import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class PartnerCapability(Base, TimestampMixin):
    """Individual skill/capability of a partner with proficiency level."""

    __tablename__ = "partner_capabilities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("partner_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    capability_name: Mapped[str] = mapped_column(String(100), nullable=False)
    # beginner, intermediate, expert
    proficiency_level: Mapped[str] = mapped_column(String(20), nullable=False)
    years_experience: Mapped[float | None] = mapped_column(Numeric(5, 1), nullable=True)
    verified: Mapped[bool | None] = mapped_column(Boolean, default=False)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    partner = relationship("PartnerProfile", back_populates="capabilities_detail")
    verifier = relationship("User", foreign_keys=[verified_by])


class ServiceCategory(Base, TimestampMixin):
    """Service categories with required capabilities."""

    __tablename__ = "service_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # List of capability names required
    required_capabilities: Mapped[list[str] | None] = mapped_column(JSON, default=list)
    active: Mapped[bool | None] = mapped_column(Boolean, default=True)

    # Relationships
    qualifications = relationship(
        "PartnerQualification", back_populates="category", cascade="all, delete-orphan"
    )


class PartnerQualification(Base, TimestampMixin):
    """Partner qualification for a service category."""

    __tablename__ = "partner_qualifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("partner_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("service_categories.id", ondelete="CASCADE"),
        nullable=False,
    )
    # qualified, preferred, expert
    qualification_level: Mapped[str] = mapped_column(String(20), nullable=False)
    # pending, approved, rejected
    approval_status: Mapped[str | None] = mapped_column(String(20), default="pending")
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    partner = relationship("PartnerProfile", back_populates="qualifications_detail")
    category = relationship("ServiceCategory", back_populates="qualifications")
    approver = relationship("User", foreign_keys=[approved_by])


class PartnerCertification(Base, TimestampMixin):
    """Partner certifications with expiry tracking."""

    __tablename__ = "partner_certifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("partner_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    issuing_body: Mapped[str] = mapped_column(String(200), nullable=False)
    certificate_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    document_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # pending, verified, expired, rejected
    verification_status: Mapped[str | None] = mapped_column(
        String(20), default="pending"
    )
    verified_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    partner = relationship("PartnerProfile", back_populates="certifications_detail")
    verifier = relationship("User", foreign_keys=[verified_by])


class PartnerOnboarding(Base, TimestampMixin):
    """Partner onboarding workflow tracking."""

    __tablename__ = "partner_onboarding"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("partner_profiles.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    current_stage: Mapped[str | None] = mapped_column(
        String(30), default="profile_setup"
    )
    # Stages: profile_setup, capability_matrix, compliance_docs,
    # certification_upload, review, completed
    # {stage: {item: bool}}
    checklist_items: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    # List of completed stage names
    completed_stages: Mapped[list[str] | None] = mapped_column(JSON, default=list)
    assigned_coordinator: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    partner = relationship("PartnerProfile", back_populates="onboarding_detail")
    coordinator = relationship("User", foreign_keys=[assigned_coordinator])
