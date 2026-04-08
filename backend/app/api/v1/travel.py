"""Travel booking API endpoints."""

import hmac
import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select

from app.api.deps import (
    DB,
    CurrentUser,
    RLSContext,
    get_rm_client_ids,
    require_coordinator_or_above,
    require_internal,
)
from app.core.config import settings
from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    UnauthorizedException,
)
from app.models.enums import UserRole
from app.models.program import Program
from app.models.travel_booking import TravelBooking
from app.schemas.travel_booking import (
    TravelBookingCreate,
    TravelBookingListResponse,
    TravelBookingResponse,
    TravelBookingUpdate,
    TravelWebhookPayload,
)
from app.services.travel_service import travel_service

logger = logging.getLogger(__name__)

router = APIRouter()


def build_booking_response(booking: TravelBooking) -> dict[str, Any]:
    """Build a response dict from a TravelBooking instance."""
    return {c.key: getattr(booking, c.key) for c in booking.__table__.columns}


@router.get(
    "/programs/{program_id}/travel",
    response_model=TravelBookingListResponse,
)
async def get_program_travel(
    program_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> dict[str, Any]:
    """Get all travel bookings for a program as an itinerary."""
    # Verify program exists and user has access
    result = await db.execute(select(Program).where(Program.id == program_id))
    program = result.scalar_one_or_none()
    if not program:
        raise NotFoundException("Program not found")

    # RM access check
    if current_user.role == UserRole.relationship_manager:
        rm_client_ids = await get_rm_client_ids(db, current_user.id)
        if program.client_id not in rm_client_ids and program.created_by != current_user.id:
            raise ForbiddenException("Access denied: program not in your portfolio")

    bookings = await travel_service.get_program_itinerary(db, program_id)
    return {
        "bookings": [build_booking_response(b) for b in bookings],
        "total": len(bookings),
    }


@router.post(
    "/programs/{program_id}/travel",
    response_model=TravelBookingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_travel_booking(
    program_id: uuid.UUID,
    data: TravelBookingCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
) -> dict[str, Any]:
    """Create a new travel booking for a program."""
    # Verify program exists and user has access
    result = await db.execute(select(Program).where(Program.id == program_id))
    program = result.scalar_one_or_none()
    if not program:
        raise NotFoundException("Program not found")

    # RM access check
    if current_user.role == UserRole.relationship_manager:
        rm_client_ids = await get_rm_client_ids(db, current_user.id)
        if program.client_id not in rm_client_ids and program.created_by != current_user.id:
            raise ForbiddenException("Access denied: program not in your portfolio")

    booking = await travel_service.ingest_booking(
        db=db,
        program_id=program_id,
        booking_data=data.model_dump(),
        source="manual",
        user_id=current_user.id,
    )
    return build_booking_response(booking)


@router.patch(
    "/programs/{program_id}/travel/{booking_id}",
    response_model=TravelBookingResponse,
)
async def update_travel_booking(
    program_id: uuid.UUID,
    booking_id: uuid.UUID,
    data: TravelBookingUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
) -> dict[str, Any]:
    """Update a travel booking."""
    # Verify program exists and user has access
    result = await db.execute(select(Program).where(Program.id == program_id))
    program = result.scalar_one_or_none()
    if not program:
        raise NotFoundException("Program not found")

    # RM access check
    if current_user.role == UserRole.relationship_manager:
        rm_client_ids = await get_rm_client_ids(db, current_user.id)
        if program.client_id not in rm_client_ids and program.created_by != current_user.id:
            raise ForbiddenException("Access denied: program not in your portfolio")

    booking = await travel_service.get_booking(db, booking_id)
    if not booking or booking.program_id != program_id:
        raise NotFoundException("Booking not found")

    updated = await travel_service.update_booking(
        db=db,
        booking=booking,
        update_data=data.model_dump(exclude_unset=True),
    )
    return build_booking_response(updated)


@router.delete(
    "/programs/{program_id}/travel/{booking_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_travel_booking(
    program_id: uuid.UUID,
    booking_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
) -> None:
    """Delete a travel booking."""
    # Verify program exists and user has access
    result = await db.execute(select(Program).where(Program.id == program_id))
    program = result.scalar_one_or_none()
    if not program:
        raise NotFoundException("Program not found")

    # RM access check
    if current_user.role == UserRole.relationship_manager:
        rm_client_ids = await get_rm_client_ids(db, current_user.id)
        if program.client_id not in rm_client_ids and program.created_by != current_user.id:
            raise ForbiddenException("Access denied: program not in your portfolio")

    booking = await travel_service.get_booking(db, booking_id)
    if not booking or booking.program_id != program_id:
        raise NotFoundException("Booking not found")

    await travel_service.delete_booking(db, booking)


# Webhook endpoint - separate from authenticated routes
webhook_router = APIRouter()


@webhook_router.post(
    "/travel",
    status_code=status.HTTP_201_CREATED,
)
async def receive_travel_webhook(
    data: TravelWebhookPayload,
    db: DB,
    x_travel_webhook_secret: str = Header(..., alias="X-Travel-Webhook-Secret"),
) -> dict[str, Any]:
    """Receive travel booking webhooks from external travel APIs.

    Authenticates via X-Travel-Webhook-Secret header.
    """
    # Validate webhook secret
    if not settings.TRAVEL_WEBHOOK_SECRET:
        logger.warning("Travel webhook received but TRAVEL_WEBHOOK_SECRET not configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook endpoint not configured",
        )

    if not hmac.compare_digest(x_travel_webhook_secret, settings.TRAVEL_WEBHOOK_SECRET):
        logger.warning("Invalid travel webhook secret received")
        raise UnauthorizedException("Invalid webhook secret")

    # Determine program_id - must be provided in payload
    program_id = data.program_id
    if not program_id:
        raise BadRequestException("program_id is required in webhook payload")

    # Verify program exists
    result = await db.execute(select(Program).where(Program.id == program_id))
    program = result.scalar_one_or_none()
    if not program:
        raise NotFoundException("Program not found")

    # Normalize and ingest the booking
    normalized = travel_service.normalize_webhook_payload(data.model_dump())
    normalized["booking_ref"] = data.booking_ref
    normalized["vendor"] = data.vendor
    normalized["type"] = data.type

    booking = await travel_service.ingest_booking(
        db=db,
        program_id=program_id,
        booking_data=normalized,
        source="webhook",
        raw_data=data.raw_data or data.model_dump(),
    )

    logger.info(
        "Travel webhook processed: booking %s for program %s",
        booking.id,
        program_id,
    )

    return {
        "status": "success",
        "booking_id": str(booking.id),
    }
