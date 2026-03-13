"""Calendar integration models for syncing milestones to external calendars."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CalendarConnection(Base):
    """OAuth connection to an external calendar provider (Google, Outlook)."""

    __tablename__ = "calendar_connections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(20), nullable=False)  # google, outlook
    provider_user_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    calendar_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )  # Calendar to sync to
    calendar_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sync_milestones: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sync_tasks: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reminder_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Default reminder
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sync_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    user = relationship("User", back_populates="calendar_connections")
    events = relationship(
        "CalendarEvent", back_populates="connection", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<CalendarConnection(id={self.id}, provider={self.provider}, user_id={self.user_id})>"
        )


class CalendarEvent(Base):
    """A synced event in an external calendar linked to a milestone."""

    __tablename__ = "calendar_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("calendar_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    milestone_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("milestones.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_event_id: Mapped[str] = mapped_column(
        String(255), nullable=False
    )  # Provider's event ID
    event_url: Mapped[str | None] = mapped_column(
        String(1000), nullable=True
    )  # Link to event in provider
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="confirmed"
    )  # confirmed, cancelled
    last_synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    connection = relationship("CalendarConnection", back_populates="events")
    milestone = relationship("Milestone", back_populates="calendar_events")

    def __repr__(self) -> str:
        return f"<CalendarEvent(id={self.id}, external_event_id={self.external_event_id})>"


class CalendarReminder(Base):
    """Reminder configuration for a milestone's calendar event."""

    __tablename__ = "calendar_reminders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    milestone_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("milestones.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reminder_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False
    )  # Minutes before due date
    notification_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notification_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    milestone = relationship("Milestone", back_populates="calendar_reminders")
    user = relationship("User", back_populates="calendar_reminders")

    def __repr__(self) -> str:
        return (
            f"<CalendarReminder(id={self.id}, "
            f"milestone_id={self.milestone_id}, "
            f"minutes={self.reminder_minutes})>"
        )


class CalendarAvailability(Base):
    """Cached availability data for a user from their calendar."""

    __tablename__ = "calendar_availability"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("calendar_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_busy: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    busy_periods: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    cached_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    user = relationship("User", back_populates="calendar_availability")
    connection = relationship("CalendarConnection")

    def __repr__(self) -> str:
        return f"<CalendarAvailability(id={self.id}, user_id={self.user_id})>"
