import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import TaskPriority, TaskStatus


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    milestone_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("milestones.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        String(20), nullable=False, default=TaskStatus.todo, index=True
    )
    priority: Mapped[TaskPriority] = mapped_column(
        String(20), nullable=False, default=TaskPriority.medium
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    depends_on: Mapped[list[uuid.UUID] | None] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=True, default=None
    )
    recurring_template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("recurring_task_templates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    milestone = relationship("Milestone", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assigned_to])
    recurring_template = relationship("RecurringTaskTemplate", foreign_keys=[recurring_template_id])

    def __repr__(self) -> str:
        return f"<Task(id={self.id}, title={self.title})>"
