import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import DeliveryMethod


class DocumentDelivery(Base):
    __tablename__ = "document_deliveries"
    __table_args__ = (
        Index("ix_document_deliveries_document", "document_id"),
        Index("ix_document_deliveries_recipient", "recipient_id"),
        Index("ix_document_deliveries_token", "secure_link_token", unique=True),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    recipient_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    delivery_method: Mapped[DeliveryMethod] = mapped_column(String(20), nullable=False)
    delivered_at = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    viewed_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    secure_link_token = Column(String(255), nullable=True)
    secure_link_expires_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    # Relationships
    document = relationship("Document", foreign_keys=[document_id])
    recipient = relationship("User", foreign_keys=[recipient_id])
