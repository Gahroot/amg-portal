import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import DeliverableStatus, DeliverableType


class Deliverable(Base, TimestampMixin):
    __tablename__ = "deliverables"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("partner_assignments.id"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)
    deliverable_type: Mapped[DeliverableType] = mapped_column(
        String(50), nullable=False, default=DeliverableType.document
    )
    description = Column(Text, nullable=True)
    due_date = Column(Date, nullable=True)
    file_path = Column(String(500), nullable=True)
    file_name = Column(String(255), nullable=True)
    file_size = Column(Integer, nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status: Mapped[DeliverableStatus] = mapped_column(
        String(20), nullable=False, default=DeliverableStatus.pending
    )
    review_comments = Column(Text, nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    client_visible = Column(Boolean, default=False)

# Relationships
    assignment = relationship("PartnerAssignment", back_populates="deliverables")
    submitter = relationship("User", foreign_keys=[submitted_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
