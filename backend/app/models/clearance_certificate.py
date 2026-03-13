"""Compliance clearance certificate models."""

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CertificateTemplate(Base):
    """Reusable templates for clearance certificates."""

    __tablename__ = "certificate_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # program, client, partner
    template_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # JSON or HTML template content
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Available placeholder definitions
    placeholders: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
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

    creator = relationship("User", foreign_keys=[created_by])
    certificates = relationship("ClearanceCertificate", back_populates="template")


class ClearanceCertificate(Base):
    """Generated compliance clearance certificates."""

    __tablename__ = "clearance_certificates"
    __table_args__ = (
        Index("ix_clearance_certificates_program", "program_id"),
        Index("ix_clearance_certificates_client", "client_id"),
        Index("ix_clearance_certificates_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    certificate_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("certificate_templates.id"), nullable=True
    )
    program_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id"), nullable=True
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True, index=True
    )
    client_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("client_profiles.id"), nullable=True, index=True
    )

    # Certificate content
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # Rendered content
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Data used to populate
    populated_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Certificate metadata
    # program_completion, compliance_review, etc.
    certificate_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # draft, issued, revoked, expired
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Review/approval
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # File storage
    # MinIO path to PDF
    pdf_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Audit
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
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
    template = relationship("CertificateTemplate", back_populates="certificates")
    program = relationship("Program")
    client = relationship("Client")
    client_profile = relationship("ClientProfile")
    creator = relationship("User", foreign_keys=[created_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class ClearanceCertificateHistory(Base):
    """History log for certificate status changes."""

    __tablename__ = "clearance_certificate_history"
    __table_args__ = (
        Index("ix_certificate_history_certificate", "certificate_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    certificate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clearance_certificates.id", ondelete="CASCADE"),
        nullable=False,
    )
    # created, updated, issued, revoked, etc.
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    actor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    certificate = relationship("ClearanceCertificate")
    actor = relationship("User")
