"""Capacity blocker model — date ranges a partner marks as unavailable."""

import uuid

from sqlalchemy import Boolean, Column, Date, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import relationship

from app.db.base import Base, TimestampMixin


class PartnerBlocker(Base, TimestampMixin):
    """A declared unavailability window for a partner.

    Supports single date ranges and weekly-recurring patterns (e.g. every Monday).
    While a blocker is active no new assignments should target dates it covers,
    and existing assignments whose due_date falls inside it are flagged as conflicts.
    """

    __tablename__ = "partner_blockers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(
        UUID(as_uuid=True), ForeignKey("partner_profiles.id"), nullable=False, index=True
    )
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(String(255), nullable=True)
    # Quick-pick labels: day_off | vacation | training | other
    blocker_type = Column(String(50), nullable=False, default="other")
    is_recurring = Column(Boolean, nullable=False, default=False)
    # "weekly" is the only supported type for now
    recurrence_type = Column(String(20), nullable=True)
    # ISO weekday numbers 1=Mon … 7=Sun (used when recurrence_type="weekly")
    recurrence_days = Column(JSON, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Relationships
    partner = relationship("PartnerProfile", back_populates="blockers")
    creator = relationship("User", foreign_keys=[created_by])
