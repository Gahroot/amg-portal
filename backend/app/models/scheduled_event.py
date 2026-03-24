"""Scheduled event model for coordination and scheduling."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import EventStatus, EventType


class ScheduledEvent(Base, TimestampMixin):
    """Scheduled event for meetings, calls, site visits, reviews, and deadlines."""

    __tablename__ = "scheduled_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_type: Mapped[EventType] = mapped_column(String(20), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, default="UTC")
    location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    virtual_link: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    organizer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    program_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id"), nullable=True, index=True
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True, index=True
    )
    attendee_ids: Mapped[list[uuid.UUID] | None] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=True
    )
    status: Mapped[EventStatus] = mapped_column(
        String(20), nullable=False, default=EventStatus.scheduled
    )
    recurrence_rule: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reminder_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    organizer = relationship("User", foreign_keys=[organizer_id])
    program = relationship("Program", foreign_keys=[program_id])
    client = relationship("Client", foreign_keys=[client_id])

    def __repr__(self) -> str:
        return f"<ScheduledEvent(id={self.id}, title={self.title}, type={self.event_type})>"
