"""Report schedule model for automated report generation and delivery."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ReportSchedule(Base):
    """Scheduled report configuration for automated generation and delivery."""

    __tablename__ = "report_schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # portfolio, program_status, completion, annual_review
    entity_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # program_id or client_id depending on report type
    frequency: Mapped[str] = mapped_column(String(20), nullable=False)  # daily, weekly, monthly
    next_run: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    recipients: Mapped[list[Any]] = mapped_column(JSON, nullable=False)  # list of email addresses
    format: Mapped[str] = mapped_column(String(10), nullable=False, default="pdf")  # pdf or csv
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_run: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_generated_document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    creator = relationship("User", foreign_keys=[created_by])
    last_generated_document = relationship("Document", foreign_keys=[last_generated_document_id])

    def __repr__(self) -> str:
        return f"<ReportSchedule(id={self.id}, type={self.report_type}, freq={self.frequency})>"
