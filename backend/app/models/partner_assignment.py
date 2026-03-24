import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import AssignmentStatus


class PartnerAssignment(Base, TimestampMixin):
    __tablename__ = "partner_assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("partner_profiles.id"),
        nullable=False,
        index=True,
    )
    program_id = Column(UUID(as_uuid=True), ForeignKey("programs.id"), nullable=False, index=True)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    brief = Column(Text, nullable=False)
    sla_terms = Column(Text, nullable=True)
    status: Mapped[AssignmentStatus] = mapped_column(
        String(20), nullable=False, default=AssignmentStatus.draft
    )
    due_date = Column(Date, nullable=True)
    # Offer deadline — set when dispatched, partner must respond before this
    offer_expires_at = Column(DateTime(timezone=True), nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    # Decline tracking
    declined_at = Column(DateTime(timezone=True), nullable=True)
    decline_reason = Column(Text, nullable=True)
    brief_pdf_path = Column(String(500), nullable=True)

    # Relationships
    partner = relationship("PartnerProfile", back_populates="assignments")
    program = relationship("Program", backref="partner_assignments")
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

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("partner_assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    # e.g. "accepted", "declined", "dispatched", "expired"
    event = Column(String(50), nullable=False, index=True)
    # Free-text reason — used for decline_reason and escalation notes
    reason = Column(Text, nullable=True)

    assignment = relationship("PartnerAssignment", back_populates="history")
    actor = relationship("User", foreign_keys=[actor_id])
