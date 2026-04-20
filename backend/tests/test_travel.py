"""Tests for /api/v1/programs/{program_id}/travel endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.program import Program
from app.models.travel_booking import TravelBooking
from app.models.user import User

BASE = "/api/v1/programs"
WEBHOOK_BASE = "/api/v1"


# ---------------------------------------------------------------------------
# Shared fixtures (travel-test scope)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_program(
    db_session: AsyncSession,
    db_client: Client,
    rm_user: User,
) -> Program:
    """A Program in ``active`` status for travel booking tests."""
    program = Program(
        id=uuid.uuid4(),
        client_id=db_client.id,
        title="Travel Planning Program",
        objectives="Executive travel coordination.",
        budget_envelope=100_000.0,
        status="active",
        created_by=rm_user.id,
    )
    db_session.add(program)
    await db_session.commit()
    return program


@pytest_asyncio.fixture
async def test_travel_booking(
    db_session: AsyncSession,
    test_program: Program,
    coordinator_user: User,
) -> TravelBooking:
    """A TravelBooking linked to test_program."""
    booking = TravelBooking(
        id=uuid.uuid4(),
        program_id=test_program.id,
        booking_ref="FL-12345",
        vendor="British Airways",
        type="flight",
        departure_at=datetime.utcnow() + timedelta(days=7),
        arrival_at=datetime.utcnow() + timedelta(days=7, hours=8),
        passengers=["John Doe", "Jane Smith"],
        details={"flight_number": "BA123", "class": "business"},
        status="confirmed",
        source="manual",
        created_by=coordinator_user.id,
    )
    db_session.add(booking)
    await db_session.commit()
    return booking


@pytest_asyncio.fixture
async def test_program_other_rm(
    db_session: AsyncSession,
    rm_user_b: User,
) -> Program:
    """A Program belonging to a different RM (for scoping tests)."""
    # Create a client assigned to rm_user_b
    other_client = Client(
        id=uuid.uuid4(),
        name="Other RM Client",
        client_type="family_office",
        rm_id=rm_user_b.id,
        status="active",
    )
    db_session.add(other_client)
    await db_session.commit()

    program = Program(
        id=uuid.uuid4(),
        client_id=other_client.id,
        title="Other RM Program",
        status="active",
        created_by=rm_user_b.id,
    )
    db_session.add(program)
    await db_session.commit()
    return program


# ---------------------------------------------------------------------------
# TestGetProgramTravel - list travel bookings for a program
# ---------------------------------------------------------------------------


class TestGetProgramTravel:
    """Tests for GET /programs/{program_id}/travel endpoint."""

    async def test_rm_can_list_travel_bookings(
        self,
        rm_client: AsyncClient,
        test_program: Program,
        test_travel_booking: TravelBooking,
    ) -> None:
        """RM can list travel bookings for their program."""
        resp = await rm_client.get(f"{BASE}/{test_program.id}/travel")
        assert resp.status_code == 200
        data = resp.json()
        assert "bookings" in data
        assert "total" in data
        assert data["total"] >= 1
        booking_refs = [b["booking_ref"] for b in data["bookings"]]
        assert "FL-12345" in booking_refs

    async def test_coordinator_can_list_travel_bookings(
        self,
        coordinator_client: AsyncClient,
        test_program: Program,
        test_travel_booking: TravelBooking,
    ) -> None:
        """Coordinator can list travel bookings."""
        resp = await coordinator_client.get(f"{BASE}/{test_program.id}/travel")
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    async def test_md_can_list_travel_bookings(
        self,
        md_client: AsyncClient,
        test_program: Program,
        test_travel_booking: TravelBooking,
    ) -> None:
        """MD can list travel bookings for any program."""
        resp = await md_client.get(f"{BASE}/{test_program.id}/travel")
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    async def test_client_user_cannot_list_travel(
        self,
        client_user_http: AsyncClient,
        test_program: Program,
    ) -> None:
        """Client users are forbidden from internal travel endpoints."""
        resp = await client_user_http.get(f"{BASE}/{test_program.id}/travel")
        assert resp.status_code == 403

    async def test_partner_user_cannot_list_travel(
        self,
        partner_http: AsyncClient,
        test_program: Program,
    ) -> None:
        """Partner users are forbidden from internal travel endpoints."""
        resp = await partner_http.get(f"{BASE}/{test_program.id}/travel")
        assert resp.status_code == 403

    async def test_rm_scoped_to_own_programs(
        self,
        rm_client: AsyncClient,
        test_program_other_rm: Program,
    ) -> None:
        """RM cannot list travel for programs outside their portfolio."""
        resp = await rm_client.get(f"{BASE}/{test_program_other_rm.id}/travel")
        assert resp.status_code == 403

    async def test_list_returns_empty_for_program_with_no_bookings(
        self,
        rm_client: AsyncClient,
        test_program: Program,
        db_session: AsyncSession,
    ) -> None:
        """Listing travel for a program with no bookings returns empty list."""
        # Create a new program with no bookings
        new_program = Program(
            id=uuid.uuid4(),
            client_id=test_program.client_id,
            title="Empty Program",
            status="active",
            created_by=test_program.created_by,
        )
        db_session.add(new_program)
        await db_session.commit()

        resp = await rm_client.get(f"{BASE}/{new_program.id}/travel")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["bookings"] == []

    async def test_nonexistent_program_returns_404(
        self,
        rm_client: AsyncClient,
    ) -> None:
        """Requesting travel for nonexistent program returns 404."""
        fake_id = uuid.uuid4()
        resp = await rm_client.get(f"{BASE}/{fake_id}/travel")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# TestCreateTravelBooking - create booking
# ---------------------------------------------------------------------------


class TestCreateTravelBooking:
    """Tests for POST /programs/{program_id}/travel endpoint."""

    async def test_coordinator_can_create_booking(
        self,
        coordinator_client: AsyncClient,
        test_program: Program,
    ) -> None:
        """Coordinator can create a travel booking."""
        resp = await coordinator_client.post(
            f"{BASE}/{test_program.id}/travel",
            json={
                "booking_ref": "HT-67890",
                "vendor": "Marriott",
                "type": "hotel",
                "departure_at": (datetime.utcnow() + timedelta(days=5)).isoformat(),
                "arrival_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
                "passengers": ["John Doe"],
                "details": {"room_type": "suite", "nights": 2},
                "status": "confirmed",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["booking_ref"] == "HT-67890"
        assert data["vendor"] == "Marriott"
        assert data["type"] == "hotel"
        assert data["source"] == "manual"

    async def test_rm_can_create_booking(
        self,
        rm_client: AsyncClient,
        test_program: Program,
    ) -> None:
        """RM can create a travel booking for their program."""
        resp = await rm_client.post(
            f"{BASE}/{test_program.id}/travel",
            json={
                "booking_ref": "TR-11111",
                "vendor": "Blacklane",
                "type": "transfer",
                "passengers": ["Executive A"],
            },
        )
        assert resp.status_code == 201
        assert resp.json()["booking_ref"] == "TR-11111"

    async def test_md_can_create_booking(
        self,
        md_client: AsyncClient,
        test_program: Program,
    ) -> None:
        """MD can create a travel booking."""
        resp = await md_client.post(
            f"{BASE}/{test_program.id}/travel",
            json={
                "booking_ref": "VN-22222",
                "vendor": "Shangri-La",
                "type": "venue",
            },
        )
        assert resp.status_code == 201

    async def test_client_user_cannot_create_booking(
        self,
        client_user_http: AsyncClient,
        test_program: Program,
    ) -> None:
        """Client users cannot create travel bookings."""
        resp = await client_user_http.post(
            f"{BASE}/{test_program.id}/travel",
            json={
                "booking_ref": "BLOCKED",
                "vendor": "Test",
                "type": "flight",
            },
        )
        assert resp.status_code == 403

    async def test_partner_user_cannot_create_booking(
        self,
        partner_http: AsyncClient,
        test_program: Program,
    ) -> None:
        """Partner users cannot create travel bookings."""
        resp = await partner_http.post(
            f"{BASE}/{test_program.id}/travel",
            json={
                "booking_ref": "BLOCKED",
                "vendor": "Test",
                "type": "flight",
            },
        )
        assert resp.status_code == 403

    async def test_create_booking_with_invalid_type_returns_422(
        self,
        coordinator_client: AsyncClient,
        test_program: Program,
    ) -> None:
        """Invalid booking type returns validation error."""
        resp = await coordinator_client.post(
            f"{BASE}/{test_program.id}/travel",
            json={
                "booking_ref": "BAD-TYPE",
                "vendor": "Test",
                "type": "cruise",  # Invalid type
            },
        )
        assert resp.status_code == 422

    async def test_create_booking_with_invalid_status_returns_422(
        self,
        coordinator_client: AsyncClient,
        test_program: Program,
    ) -> None:
        """Invalid status returns validation error."""
        resp = await coordinator_client.post(
            f"{BASE}/{test_program.id}/travel",
            json={
                "booking_ref": "BAD-STATUS",
                "vendor": "Test",
                "type": "flight",
                "status": "unknown",  # Invalid status
            },
        )
        assert resp.status_code == 422

    async def test_rm_scoped_to_own_programs_on_create(
        self,
        rm_client: AsyncClient,
        test_program_other_rm: Program,
    ) -> None:
        """RM cannot create bookings for programs outside their portfolio."""
        resp = await rm_client.post(
            f"{BASE}/{test_program_other_rm.id}/travel",
            json={
                "booking_ref": "NOPE",
                "vendor": "Test",
                "type": "flight",
            },
        )
        assert resp.status_code == 403

    async def test_create_for_nonexistent_program_returns_404(
        self,
        coordinator_client: AsyncClient,
    ) -> None:
        """Creating booking for nonexistent program returns 404."""
        resp = await coordinator_client.post(
            f"{BASE}/{uuid.uuid4()}/travel",
            json={
                "booking_ref": "GHOST",
                "vendor": "Test",
                "type": "flight",
            },
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# TestUpdateTravelBooking - update booking
# ---------------------------------------------------------------------------


class TestUpdateTravelBooking:
    """Tests for PATCH /programs/{program_id}/travel/{booking_id} endpoint."""

    async def test_coordinator_can_update_booking(
        self,
        coordinator_client: AsyncClient,
        test_program: Program,
        test_travel_booking: TravelBooking,
    ) -> None:
        """Coordinator can update a travel booking."""
        resp = await coordinator_client.patch(
            f"{BASE}/{test_program.id}/travel/{test_travel_booking.id}",
            json={"status": "completed"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"

    async def test_rm_can_update_booking(
        self,
        rm_client: AsyncClient,
        test_program: Program,
        test_travel_booking: TravelBooking,
    ) -> None:
        """RM can update a travel booking."""
        resp = await rm_client.patch(
            f"{BASE}/{test_program.id}/travel/{test_travel_booking.id}",
            json={"vendor": "Emirates", "details": {"upgraded": True}},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["vendor"] == "Emirates"
        assert data["details"]["upgraded"] is True

    async def test_md_can_update_booking(
        self,
        md_client: AsyncClient,
        test_program: Program,
        test_travel_booking: TravelBooking,
    ) -> None:
        """MD can update a travel booking."""
        resp = await md_client.patch(
            f"{BASE}/{test_program.id}/travel/{test_travel_booking.id}",
            json={"booking_ref": "UPDATED-REF"},
        )
        assert resp.status_code == 200
        assert resp.json()["booking_ref"] == "UPDATED-REF"

    async def test_client_user_cannot_update_booking(
        self,
        client_user_http: AsyncClient,
        test_program: Program,
        test_travel_booking: TravelBooking,
    ) -> None:
        """Client users cannot update travel bookings."""
        resp = await client_user_http.patch(
            f"{BASE}/{test_program.id}/travel/{test_travel_booking.id}",
            json={"status": "cancelled"},
        )
        assert resp.status_code == 403

    async def test_partner_user_cannot_update_booking(
        self,
        partner_http: AsyncClient,
        test_program: Program,
        test_travel_booking: TravelBooking,
    ) -> None:
        """Partner users cannot update travel bookings."""
        resp = await partner_http.patch(
            f"{BASE}/{test_program.id}/travel/{test_travel_booking.id}",
            json={"status": "cancelled"},
        )
        assert resp.status_code == 403

    async def test_update_nonexistent_booking_returns_404(
        self,
        coordinator_client: AsyncClient,
        test_program: Program,
    ) -> None:
        """Updating nonexistent booking returns 404."""
        resp = await coordinator_client.patch(
            f"{BASE}/{test_program.id}/travel/{uuid.uuid4()}",
            json={"status": "cancelled"},
        )
        assert resp.status_code == 404

    async def test_update_booking_wrong_program_returns_404(
        self,
        coordinator_client: AsyncClient,
        test_program_other_rm: Program,
        test_travel_booking: TravelBooking,
    ) -> None:
        """Updating booking with wrong program_id returns 404."""
        resp = await coordinator_client.patch(
            f"{BASE}/{test_program_other_rm.id}/travel/{test_travel_booking.id}",
            json={"status": "cancelled"},
        )
        assert resp.status_code == 404

    async def test_update_with_invalid_status_returns_422(
        self,
        coordinator_client: AsyncClient,
        test_program: Program,
        test_travel_booking: TravelBooking,
    ) -> None:
        """Invalid status returns validation error."""
        resp = await coordinator_client.patch(
            f"{BASE}/{test_program.id}/travel/{test_travel_booking.id}",
            json={"status": "invalid_status"},
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# TestDeleteTravelBooking - delete booking
# ---------------------------------------------------------------------------


class TestDeleteTravelBooking:
    """Tests for DELETE /programs/{program_id}/travel/{booking_id} endpoint."""

    async def test_coordinator_can_delete_booking(
        self,
        coordinator_client: AsyncClient,
        test_program: Program,
        db_session: AsyncSession,
        coordinator_user: User,
    ) -> None:
        """Coordinator can delete a travel booking."""
        # Create a booking to delete
        booking = TravelBooking(
            id=uuid.uuid4(),
            program_id=test_program.id,
            booking_ref="TO-DELETE",
            vendor="Test Vendor",
            type="flight",
            created_by=coordinator_user.id,
        )
        db_session.add(booking)
        await db_session.commit()

        resp = await coordinator_client.delete(f"{BASE}/{test_program.id}/travel/{booking.id}")
        assert resp.status_code == 204

    async def test_rm_can_delete_booking(
        self,
        rm_client: AsyncClient,
        test_program: Program,
        db_session: AsyncSession,
        coordinator_user: User,
    ) -> None:
        """RM can delete a travel booking."""
        booking = TravelBooking(
            id=uuid.uuid4(),
            program_id=test_program.id,
            booking_ref="RM-DELETE",
            vendor="Test",
            type="hotel",
            created_by=coordinator_user.id,
        )
        db_session.add(booking)
        await db_session.commit()

        resp = await rm_client.delete(f"{BASE}/{test_program.id}/travel/{booking.id}")
        assert resp.status_code == 204

    async def test_md_can_delete_booking(
        self,
        md_client: AsyncClient,
        test_program: Program,
        db_session: AsyncSession,
        coordinator_user: User,
    ) -> None:
        """MD can delete a travel booking."""
        booking = TravelBooking(
            id=uuid.uuid4(),
            program_id=test_program.id,
            booking_ref="MD-DELETE",
            vendor="Test",
            type="transfer",
            created_by=coordinator_user.id,
        )
        db_session.add(booking)
        await db_session.commit()

        resp = await md_client.delete(f"{BASE}/{test_program.id}/travel/{booking.id}")
        assert resp.status_code == 204

    async def test_client_user_cannot_delete_booking(
        self,
        client_user_http: AsyncClient,
        test_program: Program,
        test_travel_booking: TravelBooking,
    ) -> None:
        """Client users cannot delete travel bookings."""
        resp = await client_user_http.delete(
            f"{BASE}/{test_program.id}/travel/{test_travel_booking.id}"
        )
        assert resp.status_code == 403

    async def test_partner_user_cannot_delete_booking(
        self,
        partner_http: AsyncClient,
        test_program: Program,
        test_travel_booking: TravelBooking,
    ) -> None:
        """Partner users cannot delete travel bookings."""
        resp = await partner_http.delete(
            f"{BASE}/{test_program.id}/travel/{test_travel_booking.id}"
        )
        assert resp.status_code == 403

    async def test_delete_nonexistent_booking_returns_404(
        self,
        coordinator_client: AsyncClient,
        test_program: Program,
    ) -> None:
        """Deleting nonexistent booking returns 404."""
        resp = await coordinator_client.delete(f"{BASE}/{test_program.id}/travel/{uuid.uuid4()}")
        assert resp.status_code == 404

    async def test_delete_booking_wrong_program_returns_404(
        self,
        coordinator_client: AsyncClient,
        test_program_other_rm: Program,
        test_travel_booking: TravelBooking,
    ) -> None:
        """Deleting booking with wrong program_id returns 404."""
        resp = await coordinator_client.delete(
            f"{BASE}/{test_program_other_rm.id}/travel/{test_travel_booking.id}"
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# TestTravelWebhook - webhook endpoint tests
# ---------------------------------------------------------------------------


class TestTravelWebhook:
    """Tests for POST /travel webhook endpoint."""

    async def test_webhook_with_valid_secret(
        self,
        anon_client: AsyncClient,
        test_program: Program,
    ) -> None:
        """Webhook with valid secret creates booking."""
        with patch("app.api.v1.travel.settings") as mock_settings:
            mock_settings.TRAVEL_WEBHOOK_SECRET = "test-secret-key"

            resp = await anon_client.post(
                f"{WEBHOOK_BASE}/travel",
                json={
                    "program_id": str(test_program.id),
                    "booking_ref": "WEBHOOK-001",
                    "vendor": "Amadeus API",
                    "type": "flight",
                    "departure_at": (datetime.utcnow() + timedelta(days=3)).isoformat(),
                    "arrival_at": (datetime.utcnow() + timedelta(days=3, hours=6)).isoformat(),
                    "passengers": ["VIP Guest"],
                    "details": {"api_source": "amadeus"},
                },
                headers={"X-Travel-Webhook-Secret": "test-secret-key"},
            )
            assert resp.status_code == 201
            data = resp.json()
            assert data["status"] == "success"
            assert "booking_id" in data

    async def test_webhook_with_invalid_secret_returns_401(
        self,
        anon_client: AsyncClient,
        test_program: Program,
    ) -> None:
        """Webhook with invalid secret returns 401."""
        with patch("app.api.v1.travel.settings") as mock_settings:
            mock_settings.TRAVEL_WEBHOOK_SECRET = "correct-secret"

            resp = await anon_client.post(
                f"{WEBHOOK_BASE}/travel",
                json={
                    "program_id": str(test_program.id),
                    "booking_ref": "WEBHOOK-BAD",
                    "vendor": "Test",
                    "type": "flight",
                },
                headers={"X-Travel-Webhook-Secret": "wrong-secret"},
            )
            assert resp.status_code == 401

    async def test_webhook_without_secret_header_returns_422(
        self,
        anon_client: AsyncClient,
        test_program: Program,
    ) -> None:
        """Webhook without secret header returns 422 (missing required header)."""
        with patch("app.api.v1.travel.settings") as mock_settings:
            mock_settings.TRAVEL_WEBHOOK_SECRET = "test-secret"

            resp = await anon_client.post(
                f"{WEBHOOK_BASE}/travel",
                json={
                    "program_id": str(test_program.id),
                    "booking_ref": "WEBHOOK-NO-HEADER",
                    "vendor": "Test",
                    "type": "flight",
                },
            )
            # FastAPI returns 422 for missing required header
            assert resp.status_code == 422

    async def test_webhook_with_unconfigured_secret_returns_503(
        self,
        anon_client: AsyncClient,
        test_program: Program,
    ) -> None:
        """Webhook returns 503 if TRAVEL_WEBHOOK_SECRET is not configured."""
        with patch("app.api.v1.travel.settings") as mock_settings:
            mock_settings.TRAVEL_WEBHOOK_SECRET = ""

            resp = await anon_client.post(
                f"{WEBHOOK_BASE}/travel",
                json={
                    "program_id": str(test_program.id),
                    "booking_ref": "WEBHOOK-NO-CONFIG",
                    "vendor": "Test",
                    "type": "flight",
                },
                headers={"X-Travel-Webhook-Secret": "any-secret"},
            )
            assert resp.status_code == 503

    async def test_webhook_without_program_id_returns_400(
        self,
        anon_client: AsyncClient,
    ) -> None:
        """Webhook without program_id returns 400."""
        with patch("app.api.v1.travel.settings") as mock_settings:
            mock_settings.TRAVEL_WEBHOOK_SECRET = "test-secret"

            resp = await anon_client.post(
                f"{WEBHOOK_BASE}/travel",
                json={
                    "booking_ref": "WEBHOOK-NO-PROG",
                    "vendor": "Test",
                    "type": "flight",
                },
                headers={"X-Travel-Webhook-Secret": "test-secret"},
            )
            assert resp.status_code == 400

    async def test_webhook_with_nonexistent_program_returns_404(
        self,
        anon_client: AsyncClient,
    ) -> None:
        """Webhook with nonexistent program_id returns 404."""
        with patch("app.api.v1.travel.settings") as mock_settings:
            mock_settings.TRAVEL_WEBHOOK_SECRET = "test-secret"

            resp = await anon_client.post(
                f"{WEBHOOK_BASE}/travel",
                json={
                    "program_id": str(uuid.uuid4()),
                    "booking_ref": "WEBHOOK-GHOST",
                    "vendor": "Test",
                    "type": "flight",
                },
                headers={"X-Travel-Webhook-Secret": "test-secret"},
            )
            assert resp.status_code == 404

    async def test_webhook_with_invalid_type_returns_422(
        self,
        anon_client: AsyncClient,
        test_program: Program,
    ) -> None:
        """Webhook with invalid booking type returns 422."""
        with patch("app.api.v1.travel.settings") as mock_settings:
            mock_settings.TRAVEL_WEBHOOK_SECRET = "test-secret"

            resp = await anon_client.post(
                f"{WEBHOOK_BASE}/travel",
                json={
                    "program_id": str(test_program.id),
                    "booking_ref": "WEBHOOK-BAD-TYPE",
                    "vendor": "Test",
                    "type": "yacht",  # Invalid type
                },
                headers={"X-Travel-Webhook-Secret": "test-secret"},
            )
            assert resp.status_code == 422

    async def test_webhook_creates_booking_with_source_webhook(
        self,
        anon_client: AsyncClient,
        test_program: Program,
        db_session: AsyncSession,
    ) -> None:
        """Webhook-created booking has source='webhook'."""
        with patch("app.api.v1.travel.settings") as mock_settings:
            mock_settings.TRAVEL_WEBHOOK_SECRET = "test-secret"

            resp = await anon_client.post(
                f"{WEBHOOK_BASE}/travel",
                json={
                    "program_id": str(test_program.id),
                    "booking_ref": "WEBHOOK-SOURCE-CHECK",
                    "vendor": "Sabre",
                    "type": "hotel",
                },
                headers={"X-Travel-Webhook-Secret": "test-secret"},
            )
            assert resp.status_code == 201

            # Verify the booking was created with source='webhook'
            from sqlalchemy import select

            result = await db_session.execute(
                select(TravelBooking).where(TravelBooking.booking_ref == "WEBHOOK-SOURCE-CHECK")
            )
            booking = result.scalar_one_or_none()
            assert booking is not None
            assert booking.source == "webhook"

    async def test_webhook_stores_raw_data(
        self,
        anon_client: AsyncClient,
        test_program: Program,
        db_session: AsyncSession,
    ) -> None:
        """Webhook stores raw_data from external API."""
        with patch("app.api.v1.travel.settings") as mock_settings:
            mock_settings.TRAVEL_WEBHOOK_SECRET = "test-secret"

            raw_payload = {
                "program_id": str(test_program.id),
                "booking_ref": "WEBHOOK-RAW-DATA",
                "vendor": "External API",
                "type": "transfer",
                "custom_field": "custom_value",
                "nested": {"key": "value"},
            }

            resp = await anon_client.post(
                f"{WEBHOOK_BASE}/travel",
                json=raw_payload,
                headers={"X-Travel-Webhook-Secret": "test-secret"},
            )
            assert resp.status_code == 201

            # Verify raw_data was stored
            from sqlalchemy import select

            result = await db_session.execute(
                select(TravelBooking).where(TravelBooking.booking_ref == "WEBHOOK-RAW-DATA")
            )
            booking = result.scalar_one_or_none()
            assert booking is not None
            assert booking.raw_data is not None
