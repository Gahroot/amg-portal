"""Tests for /api/v1/scheduling (scheduling and coordination) endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.scheduled_event import ScheduledEvent
from app.models.user import User

BASE = "/api/v1/scheduling"


# ---------------------------------------------------------------------------
# Shared fixtures (scheduling-test scope)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_schedule_event(
    db_session: AsyncSession,
    rm_user: User,
) -> ScheduledEvent:
    """A scheduled event in ``scheduled`` status."""
    event = ScheduledEvent(
        id=uuid.uuid4(),
        title="Quarterly Review Meeting",
        description="Q4 review with stakeholders",
        event_type="meeting",
        start_time=datetime.utcnow() + timedelta(days=7),
        end_time=datetime.utcnow() + timedelta(days=7, hours=1),
        timezone="UTC",
        location="Conference Room A",
        organizer_id=rm_user.id,
        status="scheduled",
        reminder_minutes=30,
    )
    db_session.add(event)
    await db_session.commit()
    return event


@pytest_asyncio.fixture
async def test_schedule_event_confirmed(
    db_session: AsyncSession,
    rm_user: User,
) -> ScheduledEvent:
    """A scheduled event already in ``confirmed`` status."""
    event = ScheduledEvent(
        id=uuid.uuid4(),
        title="Confirmed Strategy Session",
        description="Strategic planning",
        event_type="call",
        start_time=datetime.utcnow() + timedelta(days=3),
        end_time=datetime.utcnow() + timedelta(days=3, hours=1),
        timezone="UTC",
        virtual_link="https://zoom.us/test",
        organizer_id=rm_user.id,
        status="confirmed",
        reminder_minutes=15,
    )
    db_session.add(event)
    await db_session.commit()
    return event


@pytest_asyncio.fixture
async def test_schedule_event_cancelled(
    db_session: AsyncSession,
    rm_user: User,
) -> ScheduledEvent:
    """A cancelled event."""
    event = ScheduledEvent(
        id=uuid.uuid4(),
        title="Cancelled Event",
        description="This was cancelled",
        event_type="deadline",
        start_time=datetime.utcnow() + timedelta(days=1),
        end_time=datetime.utcnow() + timedelta(days=1, hours=1),
        timezone="UTC",
        organizer_id=rm_user.id,
        status="cancelled",
        reminder_minutes=30,
    )
    db_session.add(event)
    await db_session.commit()
    return event


@pytest_asyncio.fixture
async def test_schedule_event_with_client(
    db_session: AsyncSession,
    rm_user: User,
    db_client: Client,
) -> ScheduledEvent:
    """A scheduled event linked to a client."""
    event = ScheduledEvent(
        id=uuid.uuid4(),
        title="Client Onboarding Call",
        description="Initial onboarding",
        event_type="call",
        start_time=datetime.utcnow() + timedelta(days=5),
        end_time=datetime.utcnow() + timedelta(days=5, hours=1),
        timezone="UTC",
        organizer_id=rm_user.id,
        client_id=db_client.id,
        status="scheduled",
        reminder_minutes=30,
    )
    db_session.add(event)
    await db_session.commit()
    return event


# ---------------------------------------------------------------------------
# List schedule events
# ---------------------------------------------------------------------------


class TestListScheduleEvents:
    async def test_internal_staff_can_list_events(self, rm_client: AsyncClient) -> None:
        resp = await rm_client.get(f"{BASE}/events")
        assert resp.status_code == 200
        data = resp.json()
        assert "events" in data
        assert "total" in data

    async def test_coordinator_can_list_events(self, coordinator_client: AsyncClient) -> None:
        resp = await coordinator_client.get(f"{BASE}/events")
        assert resp.status_code == 200

    async def test_md_can_list_events(self, md_client: AsyncClient) -> None:
        resp = await md_client.get(f"{BASE}/events")
        assert resp.status_code == 200

    async def test_client_user_cannot_list_events(self, client_user_http: AsyncClient) -> None:
        resp = await client_user_http.get(f"{BASE}/events")
        assert resp.status_code == 403

    async def test_partner_cannot_list_events(self, partner_http: AsyncClient) -> None:
        resp = await partner_http.get(f"{BASE}/events")
        assert resp.status_code == 403

    async def test_list_with_status_filter(
        self, rm_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await rm_client.get(f"{BASE}/events?status=scheduled")
        assert resp.status_code == 200
        data = resp.json()
        assert all(e["status"] == "scheduled" for e in data["events"])

    async def test_list_with_event_type_filter(
        self, rm_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await rm_client.get(f"{BASE}/events?event_type=meeting")
        assert resp.status_code == 200
        data = resp.json()
        assert all(e["event_type"] == "meeting" for e in data["events"])

    async def test_list_with_pagination(
        self, rm_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await rm_client.get(f"{BASE}/events?skip=0&limit=10")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["events"]) <= 10

    async def test_unauthenticated_user_cannot_list(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.get(f"{BASE}/events")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Get schedule event by ID
# ---------------------------------------------------------------------------


class TestGetScheduleEvent:
    async def test_get_event_by_id(
        self, rm_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await rm_client.get(f"{BASE}/events/{test_schedule_event.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(test_schedule_event.id)
        assert data["title"] == test_schedule_event.title

    async def test_get_event_returns_event_type(
        self, rm_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await rm_client.get(f"{BASE}/events/{test_schedule_event.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["event_type"] == "meeting"

    async def test_get_event_includes_organizer_id(
        self, rm_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await rm_client.get(f"{BASE}/events/{test_schedule_event.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert "organizer_id" in data

    async def test_get_nonexistent_event_returns_404(self, rm_client: AsyncClient) -> None:
        fake_id = uuid.uuid4()
        resp = await rm_client.get(f"{BASE}/events/{fake_id}")
        assert resp.status_code == 404

    async def test_client_user_cannot_get_event(
        self, client_user_http: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await client_user_http.get(f"{BASE}/events/{test_schedule_event.id}")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Create schedule event
# ---------------------------------------------------------------------------


class TestCreateScheduleEvent:
    async def test_rm_can_create_event(self, rm_client: AsyncClient) -> None:
        start = datetime.utcnow() + timedelta(days=10)
        end = start + timedelta(hours=1)
        resp = await rm_client.post(
            f"{BASE}/events",
            json={
                "title": "New Planning Meeting",
                "description": "Planning session",
                "event_type": "meeting",
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "timezone": "UTC",
                "location": "Office",
                "reminder_minutes": 30,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "New Planning Meeting"
        assert data["status"] == "scheduled"

    async def test_md_can_create_event(self, md_client: AsyncClient) -> None:
        start = datetime.utcnow() + timedelta(days=14)
        end = start + timedelta(hours=2)
        resp = await md_client.post(
            f"{BASE}/events",
            json={
                "title": "MD Strategy Call",
                "event_type": "call",
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
            },
        )
        assert resp.status_code == 201

    async def test_coordinator_can_create_event(self, coordinator_client: AsyncClient) -> None:
        start = datetime.utcnow() + timedelta(days=5)
        end = start + timedelta(minutes=30)
        resp = await coordinator_client.post(
            f"{BASE}/events",
            json={
                "title": "Coordinator Task Review",
                "event_type": "review",
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
            },
        )
        assert resp.status_code == 201

    async def test_create_event_with_client_id(
        self, rm_client: AsyncClient, db_client: Client
    ) -> None:
        start = datetime.utcnow() + timedelta(days=7)
        end = start + timedelta(hours=1)
        resp = await rm_client.post(
            f"{BASE}/events",
            json={
                "title": "Client Meeting",
                "event_type": "meeting",
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "client_id": str(db_client.id),
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["client_id"] == str(db_client.id)

    async def test_create_event_with_virtual_link(self, rm_client: AsyncClient) -> None:
        start = datetime.utcnow() + timedelta(days=3)
        end = start + timedelta(hours=1)
        resp = await rm_client.post(
            f"{BASE}/events",
            json={
                "title": "Virtual Standup",
                "event_type": "call",
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "virtual_link": "https://zoom.us/meeting/123",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["virtual_link"] == "https://zoom.us/meeting/123"

    async def test_create_event_with_attendees(
        self, rm_client: AsyncClient, coordinator_user: User
    ) -> None:
        start = datetime.utcnow() + timedelta(days=2)
        end = start + timedelta(hours=1)
        resp = await rm_client.post(
            f"{BASE}/events",
            json={
                "title": "Team Sync",
                "event_type": "meeting",
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "attendee_ids": [str(coordinator_user.id)],
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert str(coordinator_user.id) in [str(a) for a in data["attendee_ids"]]

    async def test_client_user_cannot_create_event(self, client_user_http: AsyncClient) -> None:
        start = datetime.utcnow() + timedelta(days=5)
        end = start + timedelta(hours=1)
        resp = await client_user_http.post(
            f"{BASE}/events",
            json={
                "title": "Blocked Event",
                "event_type": "meeting",
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
            },
        )
        assert resp.status_code == 403

    async def test_partner_cannot_create_event(self, partner_http: AsyncClient) -> None:
        start = datetime.utcnow() + timedelta(days=5)
        end = start + timedelta(hours=1)
        resp = await partner_http.post(
            f"{BASE}/events",
            json={
                "title": "Partner Event",
                "event_type": "meeting",
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
            },
        )
        assert resp.status_code == 403

    async def test_create_event_with_recurrence(self, rm_client: AsyncClient) -> None:
        start = datetime.utcnow() + timedelta(days=1)
        end = start + timedelta(hours=1)
        resp = await rm_client.post(
            f"{BASE}/events",
            json={
                "title": "Weekly Standup",
                "event_type": "meeting",
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "recurrence_rule": "FREQ=WEEKLY;BYDAY=MO",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["recurrence_rule"] == "FREQ=WEEKLY;BYDAY=MO"


# ---------------------------------------------------------------------------
# Update schedule event
# ---------------------------------------------------------------------------


class TestUpdateScheduleEvent:
    async def test_update_event_title(
        self, rm_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await rm_client.patch(
            f"{BASE}/events/{test_schedule_event.id}",
            json={"title": "Updated Title"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Updated Title"

    async def test_update_event_location(
        self, rm_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await rm_client.patch(
            f"{BASE}/events/{test_schedule_event.id}",
            json={"location": "New Conference Room"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["location"] == "New Conference Room"

    async def test_update_event_times(
        self, rm_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        new_start = datetime.utcnow() + timedelta(days=14)
        new_end = new_start + timedelta(hours=2)
        resp = await rm_client.patch(
            f"{BASE}/events/{test_schedule_event.id}",
            json={
                "start_time": new_start.isoformat(),
                "end_time": new_end.isoformat(),
            },
        )
        assert resp.status_code == 200

    async def test_update_event_notes(
        self, rm_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await rm_client.patch(
            f"{BASE}/events/{test_schedule_event.id}",
            json={"notes": "Updated notes for the meeting"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["notes"] == "Updated notes for the meeting"

    async def test_update_nonexistent_event_returns_404(self, rm_client: AsyncClient) -> None:
        fake_id = uuid.uuid4()
        resp = await rm_client.patch(
            f"{BASE}/events/{fake_id}",
            json={"title": "Ghost Event"},
        )
        assert resp.status_code == 404

    async def test_client_user_cannot_update_event(
        self, client_user_http: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await client_user_http.patch(
            f"{BASE}/events/{test_schedule_event.id}",
            json={"title": "Blocked Update"},
        )
        assert resp.status_code == 403

    async def test_coordinator_can_update_event(
        self, coordinator_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await coordinator_client.patch(
            f"{BASE}/events/{test_schedule_event.id}",
            json={"description": "Updated by coordinator"},
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Delete schedule event
# ---------------------------------------------------------------------------


class TestDeleteScheduleEvent:
    async def test_rm_can_delete_event(
        self, rm_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await rm_client.delete(f"{BASE}/events/{test_schedule_event.id}")
        assert resp.status_code == 204

    async def test_md_can_delete_event(
        self, md_client: AsyncClient, test_schedule_event_confirmed: ScheduledEvent
    ) -> None:
        resp = await md_client.delete(f"{BASE}/events/{test_schedule_event_confirmed.id}")
        assert resp.status_code == 204

    async def test_coordinator_can_delete_event(
        self, coordinator_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await coordinator_client.delete(f"{BASE}/events/{test_schedule_event.id}")
        assert resp.status_code == 204

    async def test_delete_nonexistent_event_returns_404(self, rm_client: AsyncClient) -> None:
        fake_id = uuid.uuid4()
        resp = await rm_client.delete(f"{BASE}/events/{fake_id}")
        assert resp.status_code == 404

    async def test_client_user_cannot_delete_event(
        self, client_user_http: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await client_user_http.delete(f"{BASE}/events/{test_schedule_event.id}")
        assert resp.status_code == 403

    async def test_partner_cannot_delete_event(
        self, partner_http: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await partner_http.delete(f"{BASE}/events/{test_schedule_event.id}")
        assert resp.status_code == 403

    async def test_deleted_event_not_found_on_get(
        self, rm_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        # Delete the event
        del_resp = await rm_client.delete(f"{BASE}/events/{test_schedule_event.id}")
        assert del_resp.status_code == 204

        # Try to get it - should be 404
        get_resp = await rm_client.get(f"{BASE}/events/{test_schedule_event.id}")
        assert get_resp.status_code == 404


# ---------------------------------------------------------------------------
# Availability / Conflict checking
# ---------------------------------------------------------------------------


class TestAvailability:
    async def test_check_conflicts_no_conflicts(self, rm_client: AsyncClient) -> None:
        start = datetime.utcnow() + timedelta(days=30)
        end = start + timedelta(hours=1)
        resp = await rm_client.get(
            f"{BASE}/conflicts?start={start.isoformat()}&end={end.isoformat()}"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["has_conflicts"] is False
        assert data["conflicts"] == []

    async def test_check_conflicts_with_conflict(
        self, rm_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        # Use overlapping time window
        start = test_schedule_event.start_time + timedelta(minutes=30)
        end = test_schedule_event.end_time - timedelta(minutes=15)
        resp = await rm_client.get(
            f"{BASE}/conflicts?start={start.isoformat()}&end={end.isoformat()}"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["has_conflicts"] is True
        assert len(data["conflicts"]) >= 1

    async def test_get_my_schedule(
        self, rm_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        start = datetime.utcnow() - timedelta(days=1)
        end = datetime.utcnow() + timedelta(days=30)
        resp = await rm_client.get(
            f"{BASE}/my-schedule?start={start.isoformat()}&end={end.isoformat()}"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "events" in data
        assert "total" in data

    async def test_my_schedule_includes_organized_events(
        self, rm_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        start = datetime.utcnow() - timedelta(days=1)
        end = datetime.utcnow() + timedelta(days=30)
        resp = await rm_client.get(
            f"{BASE}/my-schedule?start={start.isoformat()}&end={end.isoformat()}"
        )
        assert resp.status_code == 200
        data = resp.json()
        event_ids = [e["id"] for e in data["events"]]
        assert str(test_schedule_event.id) in event_ids

    async def test_conflicts_requires_auth(self, anon_client: AsyncClient) -> None:
        start = datetime.utcnow() + timedelta(days=1)
        end = start + timedelta(hours=1)
        resp = await anon_client.get(
            f"{BASE}/conflicts?start={start.isoformat()}&end={end.isoformat()}"
        )
        assert resp.status_code == 401

    async def test_my_schedule_requires_auth(self, anon_client: AsyncClient) -> None:
        start = datetime.utcnow() + timedelta(days=1)
        end = start + timedelta(hours=1)
        resp = await anon_client.get(
            f"{BASE}/my-schedule?start={start.isoformat()}&end={end.isoformat()}"
        )
        assert resp.status_code == 401

    async def test_client_user_can_check_own_conflicts(self, client_user_http: AsyncClient) -> None:
        start = datetime.utcnow() + timedelta(days=5)
        end = start + timedelta(hours=1)
        resp = await client_user_http.get(
            f"{BASE}/conflicts?start={start.isoformat()}&end={end.isoformat()}"
        )
        # This endpoint is available to all authenticated users
        assert resp.status_code == 200

    async def test_client_user_can_get_own_schedule(self, client_user_http: AsyncClient) -> None:
        start = datetime.utcnow() + timedelta(days=1)
        end = start + timedelta(hours=24)
        resp = await client_user_http.get(
            f"{BASE}/my-schedule?start={start.isoformat()}&end={end.isoformat()}"
        )
        # This endpoint is available to all authenticated users
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Event status transitions (confirm/cancel)
# ---------------------------------------------------------------------------


class TestEventStatusTransitions:
    async def test_confirm_event(
        self, rm_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await rm_client.post(f"{BASE}/events/{test_schedule_event.id}/confirm")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "confirmed"

    async def test_cancel_event(
        self, rm_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        resp = await rm_client.post(f"{BASE}/events/{test_schedule_event.id}/cancel")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "cancelled"

    async def test_confirm_nonexistent_event_returns_404(self, rm_client: AsyncClient) -> None:
        fake_id = uuid.uuid4()
        resp = await rm_client.post(f"{BASE}/events/{fake_id}/confirm")
        assert resp.status_code == 404

    async def test_cancel_nonexistent_event_returns_404(self, rm_client: AsyncClient) -> None:
        fake_id = uuid.uuid4()
        resp = await rm_client.post(f"{BASE}/events/{fake_id}/cancel")
        assert resp.status_code == 404

    async def test_client_user_can_confirm_event(
        self,
        client_user_http: AsyncClient,
        test_schedule_event: ScheduledEvent,
    ) -> None:
        # All authenticated users can confirm events they're part of
        resp = await client_user_http.post(f"{BASE}/events/{test_schedule_event.id}/confirm")
        assert resp.status_code == 200

    async def test_coordinator_can_cancel_event(
        self,
        coordinator_client: AsyncClient,
        test_schedule_event_confirmed: ScheduledEvent,
    ) -> None:
        resp = await coordinator_client.post(
            f"{BASE}/events/{test_schedule_event_confirmed.id}/cancel"
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# RBAC tests
# ---------------------------------------------------------------------------


class TestSchedulingRBAC:
    """Role-based access control tests for scheduling endpoints."""

    async def test_client_cannot_access_internal_list(self, client_user_http: AsyncClient) -> None:
        """Client users cannot list all internal events."""
        resp = await client_user_http.get(f"{BASE}/events")
        assert resp.status_code == 403

    async def test_partner_cannot_access_internal_list(self, partner_http: AsyncClient) -> None:
        """Partner users cannot list all internal events."""
        resp = await partner_http.get(f"{BASE}/events")
        assert resp.status_code == 403

    async def test_compliance_can_list_events(self, compliance_client: AsyncClient) -> None:
        """Finance/compliance staff can list events."""
        resp = await compliance_client.get(f"{BASE}/events")
        assert resp.status_code == 200

    async def test_compliance_can_create_event(self, compliance_client: AsyncClient) -> None:
        """Finance/compliance staff can create events."""
        start = datetime.utcnow() + timedelta(days=7)
        end = start + timedelta(hours=1)
        resp = await compliance_client.post(
            f"{BASE}/events",
            json={
                "title": "Compliance Review",
                "event_type": "review",
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
            },
        )
        assert resp.status_code == 201

    async def test_md_has_full_access(self, md_client: AsyncClient) -> None:
        """Managing directors have full access to scheduling."""
        # List
        list_resp = await md_client.get(f"{BASE}/events")
        assert list_resp.status_code == 200

        # Create
        start = datetime.utcnow() + timedelta(days=7)
        end = start + timedelta(hours=1)
        create_resp = await md_client.post(
            f"{BASE}/events",
            json={
                "title": "MD Event",
                "event_type": "meeting",
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
            },
        )
        assert create_resp.status_code == 201

    async def test_unauthenticated_access_blocked(
        self, anon_client: AsyncClient, test_schedule_event: ScheduledEvent
    ) -> None:
        """Unauthenticated users cannot access any scheduling endpoints."""
        # List
        resp = await anon_client.get(f"{BASE}/events")
        assert resp.status_code == 401

        # Get
        resp = await anon_client.get(f"{BASE}/events/{test_schedule_event.id}")
        assert resp.status_code == 401

        # Create
        resp = await anon_client.post(
            f"{BASE}/events",
            json={
                "title": "Test",
                "event_type": "meeting",
                "start_time": datetime.utcnow().isoformat(),
                "end_time": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
            },
        )
        assert resp.status_code == 401

        # Update
        resp = await anon_client.patch(
            f"{BASE}/events/{test_schedule_event.id}",
            json={"title": "Updated"},
        )
        assert resp.status_code == 401

        # Delete
        resp = await anon_client.delete(f"{BASE}/events/{test_schedule_event.id}")
        assert resp.status_code == 401
