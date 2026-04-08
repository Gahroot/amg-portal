import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import AssignmentStatus


class PartnerAssignment(Base, TimestampMixin):
    __tablename__ = "partner_assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("partner_profiles.id"),
        nullable=False,
        index=True,
    )
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id"), nullable=False, index=True
    )
    assigned_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    brief: Mapped[str] = mapped_column(Text, nullable=False)
    sla_terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[AssignmentStatus] = mapped_column(
        String(20), nullable=False, default=AssignmentStatus.draft
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Offer deadline — set when dispatched, partner must respond before this
    offer_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Decline tracking
    declined_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    decline_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    brief_pdf_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    partner = relationship("PartnerProfile", back_populates="assignments")
    program = relationship("Program", back_populates="partner_assignments")
    assigner = relationship("User", foreign_keys=[assigned_by])
    deliverables = relationship(
        "Deliverable",
        back_populates="assignment",
        cascade="all, delete-orphan",
    )
    history = relationship(
        "AssignmentHistory",
        back_populates="assignment",
        cascade="all, delete-orphan",
        order_by="AssignmentHistory.created_at",
    )


class AssignmentHistory(Base, TimestampMixin):
    """Immutable audit trail of accept/decline events on an assignment."""

    __tablename__ = "assignment_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("partner_assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    # e.g. "accepted", "declined", "dispatched", "expired"
    event: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # Free-text reason — used for decline_reason and escalation notes
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    assignment = relationship("PartnerAssignment", back_populates="history")
    actor = relationship("User", foreign_keys=[actor_id])
