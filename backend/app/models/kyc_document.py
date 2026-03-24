import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import KYCDocumentStatus, KYCDocumentType


class KYCDocument(Base, TimestampMixin):
    __tablename__ = "kyc_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True)
    document_id = Column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False, unique=True
    )
    document_type: Mapped[KYCDocumentType] = mapped_column(String(50), nullable=False)
    status: Mapped[KYCDocumentStatus] = mapped_column(
        String(20), nullable=False, default=KYCDocumentStatus.pending
    )
    expiry_date = Column(Date, nullable=True)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

# Relationships
    client = relationship("Client")
    document = relationship("Document")
    verifier = relationship("User", foreign_keys=[verified_by])
