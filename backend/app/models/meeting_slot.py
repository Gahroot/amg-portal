"""Meeting availability, blackouts, and booking models."""

import uuid
from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class RMAvailability(Base, TimestampMixin):
    """Weekly recurring availability window for a Relationship Manager.

    day_of_week: 0 = Monday … 6 = Sunday (ISO weekday - 1)
    """

    __tablename__ = "rm_availability"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rm_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0–6
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    buffer_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    rm = relationship("User", foreign_keys=[rm_id])

    def __repr__(self) -> str:
        return (
            f"<RMAvailability(rm={self.rm_id}, day={self.day_of_week}, "
            f"{self.start_time}-{self.end_time})>"
        )


class RMBlackout(Base, TimestampMixin):
    """A specific date on which an RM is unavailable for meetings."""

    __tablename__ = "rm_blackouts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rm_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    blackout_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    rm = relationship("User", foreign_keys=[rm_id])

    def __repr__(self) -> str:
        return f"<RMBlackout(rm={self.rm_id}, date={self.blackout_date})>"


class Meeting(Base, TimestampMixin):
    """A meeting booked by a client with their Relationship Manager."""

    __tablename__ = "meetings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meeting_types.id"), nullable=False, index=True
    )
    rm_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True
    )
    # User account of the client who booked
    booked_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, default="UTC")
    # pending → confirmed → completed / cancelled
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    agenda: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    virtual_link: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    # Cancellation
    cancelled_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    cancellation_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Reschedule chain — points to the meeting that was superseded
    reschedule_of_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meetings.id"), nullable=True
    )
    # Optional link to a ScheduledEvent created from this meeting
    scheduled_event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scheduled_events.id"), nullable=True
    )

    meeting_type = relationship("MeetingType", foreign_keys=[meeting_type_id])
    rm = relationship("User", foreign_keys=[rm_id])
    client = relationship("Client", foreign_keys=[client_id])
    booked_by = relationship("User", foreign_keys=[booked_by_user_id])
    cancelled_by = relationship("User", foreign_keys=[cancelled_by_id])
    original_meeting = relationship(
        "Meeting", foreign_keys=[reschedule_of_id], remote_side="Meeting.id"
    )

    def __repr__(self) -> str:
        return f"<Meeting(id={self.id}, status={self.status}, start={self.start_time})>"
