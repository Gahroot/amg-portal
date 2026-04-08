"""KYC verification workflow models."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class KYCVerification(Base):
    """Full KYC verification workflow for a client."""

    __tablename__ = "kyc_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True
    )
    status = Column(String(20), nullable=False, default="draft", index=True)
    verification_type = Column(String(20), nullable=False, default="standard")
    risk_level = Column(String(20), nullable=True)
    risk_assessment = Column(JSONB, nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(Date, nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    review_notes = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    client = relationship("Client", foreign_keys=[client_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    creator = relationship("User", foreign_keys=[created_by])
    checks = relationship(
        "KYCCheck", back_populates="verification", cascade="all, delete-orphan"
    )


class KYCCheck(Base):
    """Individual KYC check within a verification."""

    __tablename__ = "kyc_checks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    verification_id = Column(
        UUID(as_uuid=True),
        ForeignKey("kyc_verifications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    check_type = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    provider = Column(String(100), nullable=True)
    external_reference = Column(String(255), nullable=True)
    result_data = Column(JSONB, nullable=True)
    risk_score = Column(Integer, nullable=True)
    match_details = Column(JSONB, nullable=True)
    checked_at = Column(DateTime(timezone=True), nullable=True)
    checked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    verification = relationship("KYCVerification", back_populates="checks")
    checker = relationship("User", foreign_keys=[checked_by])


class KYCAlert(Base):
    """Alert for KYC status changes and document expiry."""

    __tablename__ = "kyc_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True
    )
    verification_id = Column(
        UUID(as_uuid=True), ForeignKey("kyc_verifications.id"), nullable=True
    )
    kyc_document_id = Column(
        UUID(as_uuid=True), ForeignKey("kyc_documents.id"), nullable=True
    )
    alert_type = Column(String(30), nullable=False)
    severity = Column(String(20), nullable=False, default="warning")
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    alert_metadata = Column("metadata", JSONB, nullable=True)
    is_read = Column(Integer, nullable=False, default=0)
    is_resolved = Column(Integer, nullable=False, default=0)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    # Relationships
    client = relationship("Client")
    verification = relationship("KYCVerification")
    kyc_document = relationship("KYCDocument")
    resolver = relationship("User", foreign_keys=[resolved_by])


class KYCReport(Base):
    """Compliance report for KYC."""

    __tablename__ = "kyc_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True, index=True
    )
    verification_id = Column(
        UUID(as_uuid=True), ForeignKey("kyc_verifications.id"), nullable=True
    )
    report_type = Column(String(30), nullable=False)
    title = Column(String(255), nullable=False)
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    file_path = Column(String(500), nullable=True)
    file_name = Column(String(255), nullable=True)
    summary = Column(JSONB, nullable=True)
    generated_at = Column(DateTime(timezone=True), nullable=True)
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    # Relationships
    client = relationship("Client")
    verification = relationship("KYCVerification")
    generator = relationship("User", foreign_keys=[generated_by])
