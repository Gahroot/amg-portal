import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.calendar import CalendarAvailability, CalendarConnection, CalendarReminder
    from app.models.client_profile import ClientProfile


class User(Base):
    """User account."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    mfa_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    mfa_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    mfa_backup_codes: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    client_profiles_created: Mapped[list["ClientProfile"]] = relationship(
        "ClientProfile", foreign_keys="ClientProfile.created_by", back_populates="creator"
    )
    client_profile: Mapped["ClientProfile | None"] = relationship(
        "ClientProfile", foreign_keys="ClientProfile.user_id", back_populates="user", uselist=False
    )
    calendar_connections: Mapped[list["CalendarConnection"]] = relationship(
        "CalendarConnection", back_populates="user", cascade="all, delete-orphan"
    )
    calendar_reminders: Mapped[list["CalendarReminder"]] = relationship(
        "CalendarReminder", back_populates="user", cascade="all, delete-orphan"
    )
    calendar_availability: Mapped[list["CalendarAvailability"]] = relationship(
        "CalendarAvailability", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"
