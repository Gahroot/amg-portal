"""Partner capability matrix, qualifications, certifications, and onboarding models."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import backref, relationship

from app.db.base import Base


class PartnerCapability(Base):
    """Individual skill/capability of a partner with proficiency level."""

    __tablename__ = "partner_capabilities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(
        UUID(as_uuid=True), ForeignKey("partner_profiles.id", ondelete="CASCADE"), nullable=False
    )
    capability_name = Column(String(100), nullable=False)
    proficiency_level = Column(String(20), nullable=False)  # beginner, intermediate, expert
    years_experience = Column(Numeric(5, 1), nullable=True)
    verified = Column(Boolean, default=False)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    partner = relationship("PartnerProfile", backref="capabilities_detail")
    verifier = relationship("User", foreign_keys=[verified_by])


class ServiceCategory(Base):
    """Service categories with required capabilities."""

    __tablename__ = "service_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    required_capabilities = Column(JSON, default=list)  # List of capability names required
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    qualifications = relationship(
        "PartnerQualification", back_populates="category", cascade="all, delete-orphan"
    )


class PartnerQualification(Base):
    """Partner qualification for a service category."""

    __tablename__ = "partner_qualifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(
        UUID(as_uuid=True), ForeignKey("partner_profiles.id", ondelete="CASCADE"), nullable=False
    )
    category_id = Column(
        UUID(as_uuid=True), ForeignKey("service_categories.id", ondelete="CASCADE"), nullable=False
    )
    qualification_level = Column(String(20), nullable=False)  # qualified, preferred, expert
    approval_status = Column(String(20), default="pending")  # pending, approved, rejected
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    partner = relationship("PartnerProfile", backref="qualifications_detail")
    category = relationship("ServiceCategory", back_populates="qualifications")
    approver = relationship("User", foreign_keys=[approved_by])


class PartnerCertification(Base):
    """Partner certifications with expiry tracking."""

    __tablename__ = "partner_certifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(
        UUID(as_uuid=True), ForeignKey("partner_profiles.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(200), nullable=False)
    issuing_body = Column(String(200), nullable=False)
    certificate_number = Column(String(100), nullable=True)
    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    document_url = Column(String(500), nullable=True)
    verification_status = Column(
        String(20), default="pending"
    )  # pending, verified, expired, rejected
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    partner = relationship("PartnerProfile", backref="certifications_detail")
    verifier = relationship("User", foreign_keys=[verified_by])


class PartnerOnboarding(Base):
    """Partner onboarding workflow tracking."""

    __tablename__ = "partner_onboarding"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("partner_profiles.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    current_stage = Column(String(30), default="profile_setup")
    # Stages: profile_setup, capability_matrix, compliance_docs,
    # certification_upload, review, completed
    checklist_items = Column(JSON, default=dict)  # {stage: {item: bool}}
    completed_stages = Column(JSON, default=list)  # List of completed stage names
    assigned_coordinator = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    partner = relationship("PartnerProfile", backref=backref("onboarding_detail", uselist=False))
    coordinator = relationship("User", foreign_keys=[assigned_coordinator])
