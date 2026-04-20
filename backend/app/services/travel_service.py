"""Travel booking service for managing program itineraries."""

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.travel_booking import TravelBooking

logger = logging.getLogger(__name__)


class TravelService:
    """Service for managing travel bookings linked to programs."""

    async def ingest_booking(
        self,
        db: AsyncSession,
        program_id: uuid.UUID,
        booking_data: dict[str, Any],
        source: str = "manual",
        user_id: uuid.UUID | None = None,
        raw_data: dict[str, Any] | None = None,
    ) -> TravelBooking:
        """Ingest a travel booking into a program.

        Normalizes booking data and stores it. Supports manual entry,
        API calls, and webhook ingestion.

        Args:
            db: Database session
            program_id: UUID of the program to attach the booking to
            booking_data: Dict containing booking_ref, vendor, type, etc.
            source: Origin of the booking - 'manual', 'api', or 'webhook'
            user_id: UUID of the user who created the booking (if applicable)
            raw_data: Original payload from external API/webhook

        Returns:
            Created TravelBooking instance
        """
        booking = TravelBooking(
            program_id=program_id,
            booking_ref=booking_data["booking_ref"],
            vendor=booking_data["vendor"],
            type=booking_data["type"],
            departure_at=booking_data.get("departure_at"),
            arrival_at=booking_data.get("arrival_at"),
            passengers=booking_data.get("passengers"),
            details=booking_data.get("details"),
            status=booking_data.get("status", "confirmed"),
            source=source,
            raw_data=raw_data,
            created_by=user_id,
        )
        db.add(booking)
        await db.commit()
        await db.refresh(booking)

        logger.info(
            "Ingested travel booking %s for program %s via %s",
            booking.id,
            program_id,
            source,
        )

        return booking

    async def get_program_itinerary(
        self,
        db: AsyncSession,
        program_id: uuid.UUID,
    ) -> list[TravelBooking]:
        """Get all travel bookings for a program, sorted chronologically.

        Args:
            db: Database session
            program_id: UUID of the program

        Returns:
            List of TravelBooking instances sorted by departure_at
        """
        result = await db.execute(
            select(TravelBooking)
            .where(TravelBooking.program_id == program_id)
            .order_by(TravelBooking.departure_at.asc().nulls_last())
        )
        return list(result.scalars().all())

    async def get_booking(
        self,
        db: AsyncSession,
        booking_id: uuid.UUID,
    ) -> TravelBooking | None:
        """Get a single travel booking by ID.

        Args:
            db: Database session
            booking_id: UUID of the booking

        Returns:
            TravelBooking instance or None
        """
        result = await db.execute(select(TravelBooking).where(TravelBooking.id == booking_id))
        return result.scalar_one_or_none()

    async def update_booking(
        self,
        db: AsyncSession,
        booking: TravelBooking,
        update_data: dict[str, Any],
    ) -> TravelBooking:
        """Update a travel booking.

        Args:
            db: Database session
            booking: TravelBooking instance to update
            update_data: Dict of fields to update

        Returns:
            Updated TravelBooking instance
        """
        for field, value in update_data.items():
            if value is not None and hasattr(booking, field):
                setattr(booking, field, value)
        await db.commit()
        await db.refresh(booking)
        return booking

    async def delete_booking(
        self,
        db: AsyncSession,
        booking: TravelBooking,
    ) -> None:
        """Delete a travel booking.

        Args:
            db: Database session
            booking: TravelBooking instance to delete
        """
        await db.delete(booking)
        await db.commit()
        logger.info(
            "Deleted travel booking %s from program %s",
            booking.id,
            booking.program_id,
        )

    async def find_booking_by_ref(
        self,
        db: AsyncSession,
        booking_ref: str,
    ) -> TravelBooking | None:
        """Find a booking by its reference number.

        Useful for matching webhook bookings to existing records.

        Args:
            db: Database session
            booking_ref: Booking reference string

        Returns:
            TravelBooking instance or None
        """
        result = await db.execute(
            select(TravelBooking).where(TravelBooking.booking_ref == booking_ref)
        )
        return result.scalar_one_or_none()

    def normalize_webhook_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Normalize a webhook payload to our standard booking format.

        This method can be extended to handle various travel API formats.

        Args:
            payload: Raw webhook payload

        Returns:
            Normalized booking data dict
        """
        # Basic normalization - can be extended for specific APIs
        normalized = {
            "booking_ref": payload.get("booking_ref") or payload.get("confirmation_number") or "",
            "vendor": payload.get("vendor") or payload.get("provider") or "",
            "type": self._normalize_booking_type(payload.get("type", "")),
            "departure_at": payload.get("departure_at") or payload.get("start_datetime"),
            "arrival_at": payload.get("arrival_at") or payload.get("end_datetime"),
            "passengers": payload.get("passengers") or payload.get("guests"),
            "details": payload.get("details") or {},
            "status": self._normalize_status(payload.get("status", "confirmed")),
        }
        return normalized

    def _normalize_booking_type(self, raw_type: str) -> str:
        """Normalize booking type to our standard values."""
        type_map = {
            "air": "flight",
            "flight": "flight",
            "hotel": "hotel",
            "lodging": "hotel",
            "accommodation": "hotel",
            "transfer": "transfer",
            "transport": "transfer",
            "car": "transfer",
            "venue": "venue",
            "event": "venue",
            "meeting": "venue",
        }
        return type_map.get(raw_type.lower(), "venue")

    def _normalize_status(self, raw_status: str) -> str:
        """Normalize status to our standard values."""
        status_map = {
            "confirmed": "confirmed",
            "booked": "confirmed",
            "pending": "pending",
            "awaiting": "pending",
            "cancelled": "cancelled",
            "canceled": "cancelled",
            "completed": "completed",
            "finished": "completed",
        }
        return status_map.get(raw_status.lower(), "confirmed")


travel_service = TravelService()
