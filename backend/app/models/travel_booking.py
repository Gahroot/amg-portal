"""Travel booking model for program itinerary tracking."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class TravelBooking(Base, TimestampMixin):
    """Travel booking linked to a program.

    Stores booking confirmations and itinerary data from travel & logistics APIs
    or manual entry. Supports flights, hotels, transfers, and venue bookings.
    """

    __tablename__ = "travel_bookings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id"), nullable=False, index=True
    )
    booking_ref: Mapped[str] = mapped_column(String(100), nullable=False)
    vendor: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(30), nullable=False)  # flight, hotel, transfer, venue
    departure_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    arrival_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    passengers: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    details: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="confirmed")
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")  # manual, api, webhook
    raw_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    program = relationship("Program", back_populates="travel_bookings")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<TravelBooking(id={self.id}, ref={self.booking_ref}, type={self.type})>"
