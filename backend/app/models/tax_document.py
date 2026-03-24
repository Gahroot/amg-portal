"""Tax document model for partner year-end tax documents (1099s, etc.)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import TaxDocumentStatus, TaxDocumentType


class TaxDocument(Base, TimestampMixin):
    """A year-end tax document (e.g. 1099-NEC) issued to a partner."""

    __tablename__ = "tax_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("partner_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tax_year: Mapped[int] = mapped_column(Integer, nullable=False)
    document_type: Mapped[TaxDocumentType] = mapped_column(String(30), nullable=False)
    status: Mapped[TaxDocumentStatus] = mapped_column(
        String(20), nullable=False, default=TaxDocumentStatus.draft
    )
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    generated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    partner = relationship("PartnerProfile", foreign_keys=[partner_id])
    generator = relationship("User", foreign_keys=[generated_by])

    __table_args__ = (
        Index("ix_tax_documents_partner_year", "partner_id", "tax_year"),
    )

    def __repr__(self) -> str:
        return (
            f"<TaxDocument(id={self.id}, partner={self.partner_id},"
            f" year={self.tax_year}, type={self.document_type})>"
        )


class TaxDocumentAccessLog(Base):
    """Immutable audit log recording every partner download of a tax document."""

    __tablename__ = "tax_document_access_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tax_document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tax_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    accessed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=False
    )
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    accessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )

    # Relationships
    tax_document = relationship("TaxDocument", foreign_keys=[tax_document_id])

    def __repr__(self) -> str:
        return f"<TaxDocumentAccessLog(doc={self.tax_document_id}, by={self.accessed_by})>"
