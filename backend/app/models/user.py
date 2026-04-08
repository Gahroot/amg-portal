import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import UserRole

if TYPE_CHECKING:
    from app.models.api_key import APIKey
    from app.models.calendar_feed_token import CalendarFeedToken
    from app.models.client_profile import ClientProfile
    from app.models.dashboard_config import DashboardConfig
    from app.models.partner import PartnerProfile
    from app.models.table_view import TableView


class User(Base, TimestampMixin):
    """User account."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    role: Mapped[UserRole] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    mfa_secret: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mfa_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    mfa_backup_codes: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Calendar integration tokens (stored as JSON with access_token, refresh_token, etc.)
    google_calendar_token: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    outlook_calendar_token: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    calendar_last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Tour completion tracking: maps tour_key -> True when completed/skipped
    onboarding_completed: Mapped[dict[str, bool] | None] = mapped_column(JSON, nullable=True)
    # Favorite report types (list of report type strings, e.g. ["rm_portfolio", "escalation_log"])
    report_favorites: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    # Relationships
    api_keys: Mapped[list["APIKey"]] = relationship(
        "APIKey", back_populates="user", cascade="all, delete-orphan"
    )
    client_profiles_created: Mapped[list["ClientProfile"]] = relationship(
        "ClientProfile", foreign_keys="ClientProfile.created_by", back_populates="creator"
    )
    client_profile: Mapped["ClientProfile | None"] = relationship(
        "ClientProfile",
        foreign_keys="ClientProfile.user_id",
        back_populates="user",
        uselist=False,
    )
    dashboard_config: Mapped["DashboardConfig | None"] = relationship(
        "DashboardConfig", back_populates="user", uselist=False
    )
    calendar_feed_tokens: Mapped[list["CalendarFeedToken"]] = relationship(
        "CalendarFeedToken", back_populates="user", cascade="all, delete-orphan"
    )
    table_views: Mapped[list["TableView"]] = relationship(
        "TableView", back_populates="user", cascade="all, delete-orphan"
    )
    partner_profile: Mapped["PartnerProfile | None"] = relationship(
        "PartnerProfile",
        foreign_keys="PartnerProfile.user_id",
        back_populates="user",
        uselist=False,
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"
