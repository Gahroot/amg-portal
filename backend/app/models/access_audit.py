"""Quarterly access audit tracking for compliance."""

import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class FindingType(StrEnum):
    """Types of access audit findings."""

    excessive_access = "excessive_access"
    inactive_user = "inactive_user"
    role_mismatch = "role_mismatch"
    expired_credentials = "expired_credentials"
    policy_violation = "policy_violation"
    unapproved_access = "unapproved_access"
    orphaned_account = "orphaned_account"
    other = "other"


class FindingSeverity(StrEnum):
    """Severity levels for audit findings."""

    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class FindingStatus(StrEnum):
    """Status of audit findings."""

    open = "open"
    acknowledged = "acknowledged"
    in_progress = "in_progress"
    remediated = "remediated"
    waived = "waived"
    closed = "closed"


class AccessAudit(Base):
    """Quarterly access audit for compliance tracking."""

    __tablename__ = "access_audits"
    __table_args__ = (
        Index("ix_access_audits_quarter_year", "quarter", "year", unique=True),
        Index("ix_access_audits_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    audit_period: Mapped[str] = mapped_column(String(20), nullable=False)  # "Q1 2024"
    quarter: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-4
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    # draft, in_review, completed
    auditor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    users_reviewed: Mapped[int] = mapped_column(Integer, default=0)
    permissions_verified: Mapped[int] = mapped_column(Integer, default=0)
    anomalies_found: Mapped[int] = mapped_column(Integer, default=0)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendations: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    auditor: Mapped["User | None"] = relationship("User", foreign_keys=[auditor_id])
    findings: Mapped[list["AccessAuditFinding"]] = relationship(
        "AccessAuditFinding", back_populates="audit", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<AccessAudit(id={self.id}, period={self.audit_period})>"


class AccessAuditFinding(Base):
    """Individual finding from an access audit."""

    __tablename__ = "access_audit_findings"
    __table_args__ = (
        Index("ix_access_audit_findings_audit_id", "audit_id"),
        Index("ix_access_audit_findings_status", "status"),
        Index("ix_access_audit_findings_severity", "severity"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    audit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("access_audits.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    finding_type: Mapped[str] = mapped_column(String(30), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    description: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    remediation_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    remediated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    remediated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledged_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    waived_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    waived_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    waived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
    audit: Mapped["AccessAudit"] = relationship("AccessAudit", back_populates="findings")
    user: Mapped["User | None"] = relationship("User", foreign_keys=[user_id])
    remediator: Mapped["User | None"] = relationship("User", foreign_keys=[remediated_by])
    acknowledger: Mapped["User | None"] = relationship("User", foreign_keys=[acknowledged_by])
    waiver: Mapped["User | None"] = relationship("User", foreign_keys=[waived_by])

    def __repr__(self) -> str:
        return (
            f"<AccessAuditFinding(id={self.id}, "
            f"type={self.finding_type}, severity={self.severity})>"
        )
