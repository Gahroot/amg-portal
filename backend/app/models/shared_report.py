"""Shared report model for token-based public access to reports."""

import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class SharedReport(Base, TimestampMixin):
    """A token-protected shareable link to a report."""

    __tablename__ = "shared_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # portfolio, program_status, completion, annual_review, rm_portfolio, escalation_log, compliance
    entity_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # program_id or year depending on report type
    share_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    expires_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    access_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    allow_download: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<SharedReport(id={self.id}, type={self.report_type}, active={self.is_active})>"
