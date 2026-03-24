import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import MilestoneStatus


class Milestone(Base, TimestampMixin):
    __tablename__ = "milestones"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[MilestoneStatus] = mapped_column(
        String(20), nullable=False, default=MilestoneStatus.pending
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    calendar_event_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    program = relationship("Program", back_populates="milestones")
    tasks = relationship("Task", back_populates="milestone", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Milestone(id={self.id}, title={self.title})>"
