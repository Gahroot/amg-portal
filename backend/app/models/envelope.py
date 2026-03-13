import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Envelope(Base):
    __tablename__ = "envelopes"
    __table_args__ = (
        Index("ix_envelopes_document_id", "document_id"),
        Index("ix_envelopes_envelope_id", "envelope_id"),
        Index("ix_envelopes_status", "status"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True
    )
    envelope_id = Column(String(100), nullable=False, unique=True)
    status = Column(String(20), nullable=False, default="created")
    subject = Column(String(500), nullable=False)
    recipients = Column(JSON, nullable=False, default=list)
    sender_name = Column(String(255), nullable=True)
    sender_email = Column(String(255), nullable=True)
    voided_reason = Column(Text, nullable=True)
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    sent_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    document = relationship("Document", foreign_keys=[document_id])
    creator = relationship("User", foreign_keys=[created_by])
