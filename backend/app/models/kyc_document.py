import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import KYCDocumentStatus, KYCDocumentType


class KYCDocument(Base, TimestampMixin):
    __tablename__ = "kyc_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False, unique=True
    )
    document_type: Mapped[KYCDocumentType] = mapped_column(String(50), nullable=False)
    status: Mapped[KYCDocumentStatus] = mapped_column(
        String(20), nullable=False, default=KYCDocumentStatus.pending
    )
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    client = relationship("Client")
    document = relationship("Document")
    verifier = relationship("User", foreign_keys=[verified_by])
