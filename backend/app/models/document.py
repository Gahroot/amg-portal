import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import DocumentCategory, DocumentEntityType, DocumentType, VaultStatus


class Document(Base, TimestampMixin):
    __tablename__ = "documents"
    __table_args__ = (Index("ix_documents_entity", "entity_type", "entity_id"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    content_type = Column(String(100), nullable=True)
    entity_type: Mapped[DocumentEntityType] = mapped_column(String(50), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    category: Mapped[DocumentCategory] = mapped_column(
        String(50), nullable=False, default=DocumentCategory.general
    )
    description = Column(Text, nullable=True)
    version = Column(Integer, nullable=False, default=1)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    vault_status: Mapped[VaultStatus] = mapped_column(
        String(20), nullable=False, default=VaultStatus.active, server_default="active"
    )
    sealed_at = Column(DateTime(timezone=True), nullable=True)
    sealed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    retention_policy = Column(String(50), nullable=True)
    chain_of_custody = Column(JSON, nullable=False, default=list, server_default="[]")

    # Expiry tracking
    document_type: Mapped[DocumentType | None] = mapped_column(String(50), nullable=True)
    expiry_date = Column(Date, nullable=True)
    expiry_alert_sent = Column(JSON, nullable=False, default=list, server_default="[]")

    # Relationships
    uploader = relationship("User", foreign_keys=[uploaded_by])
    sealer = relationship("User", foreign_keys=[sealed_by])
