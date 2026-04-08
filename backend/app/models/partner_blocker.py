"""Capacity blocker model — date ranges a partner marks as unavailable."""

import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class PartnerBlocker(Base, TimestampMixin):
    """A declared unavailability window for a partner.

    Supports single date ranges and weekly-recurring patterns (e.g. every Monday).
    While a blocker is active no new assignments should target dates it covers,
    and existing assignments whose due_date falls inside it are flagged as conflicts.
    """

    __tablename__ = "partner_blockers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("partner_profiles.id"), nullable=False, index=True
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Quick-pick labels: day_off | vacation | training | other
    blocker_type: Mapped[str] = mapped_column(String(50), nullable=False, default="other")
    is_recurring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # "weekly" is the only supported type for now
    recurrence_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # ISO weekday numbers 1=Mon … 7=Sun (used when recurrence_type="weekly")
    recurrence_days: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # Relationships
    partner = relationship("PartnerProfile", back_populates="blockers")
    creator = relationship("User", foreign_keys=[created_by])
