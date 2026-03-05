import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class PartnerProfile(Base):
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
    compliance_doc_url = Column(String(500), nullable=True)
    compliance_verified = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="partner_profile")
    creator = relationship("User", foreign_keys=[created_by])
    assignments = relationship(
        "PartnerAssignment",
        back_populates="partner",
        cascade="all, delete-orphan",
    )
