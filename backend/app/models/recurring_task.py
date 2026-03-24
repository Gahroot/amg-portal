"""Recurring task template model for auto-generating tasks on a schedule."""

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class RecurringTaskTemplate(Base, TimestampMixin):
    """Template that auto-creates tasks on an iCal RRULE schedule."""

    __tablename__ = "recurring_task_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    rrule: Mapped[str] = mapped_column(String(500), nullable=False)
    milestone_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("milestones.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    task_title_template: Mapped[str] = mapped_column(String(255), nullable=False)
    task_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    last_triggered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    milestone = relationship("Milestone", foreign_keys=[milestone_id])
    assignee = relationship("User", foreign_keys=[assignee_id])
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<RecurringTaskTemplate(id={self.id}, name={self.name})>"
