"""Document request model — tracks requests for documents from clients."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import DocumentRequestStatus, DocumentRequestType


class DocumentRequest(Base, TimestampMixin):
    """A request for a specific document sent to a client."""

    __tablename__ = "document_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # The client being asked to provide a document
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("client_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Internal user who made the request
    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,
    )

    # Document classification
    document_type: Mapped[DocumentRequestType] = mapped_column(
        String(50), nullable=False, default=DocumentRequestType.other
    )

    # Human-readable title, e.g. "Q3 2025 Bank Statement"
    title: Mapped[str] = mapped_column(String(500), nullable=False)

    # Detailed instructions for the client
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Personalised message shown in the portal / notification
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Workflow status
    status: Mapped[DocumentRequestStatus] = mapped_column(
        String(20), nullable=False, default=DocumentRequestStatus.pending, index=True
    )

    # Optional deadline for the client
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Timestamps for status transitions
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    in_progress_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    processing_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Estimated completion date communicated to the client
    estimated_completion: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Notes visible to the client from the RM
    rm_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Notes added by the client
    client_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # The document uploaded by the client to fulfil this request
    fulfilled_document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    requester = relationship("User", foreign_keys=[requested_by])
    fulfilled_document = relationship("Document", foreign_keys=[fulfilled_document_id])

    def __repr__(self) -> str:
        return f"<DocumentRequest(id={self.id}, title={self.title!r}, status={self.status})>"
