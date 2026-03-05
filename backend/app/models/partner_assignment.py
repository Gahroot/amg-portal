import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class PartnerAssignment(Base):
    __tablename__ = "partner_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
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
    status = Column(String(20), nullable=False, default="draft")
    due_date = Column(Date, nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    partner = relationship("PartnerProfile", back_populates="assignments")
    program = relationship("Program", backref="partner_assignments")
    assigner = relationship("User", foreign_keys=[assigned_by])
    deliverables = relationship(
        "Deliverable",
        back_populates="assignment",
        cascade="all, delete-orphan",
    )
