"""Tests for /api/v1/nps-surveys (NPS survey management) endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client_profile import ClientProfile
from app.models.nps_survey import NPSSurvey
from app.models.user import User

BASE = "/api/v1/nps-surveys"


# ---------------------------------------------------------------------------
# Local fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def nps_survey(
    db_session: AsyncSession,
    md_user: User,
) -> NPSSurvey:
    """A draft NPS survey."""
    survey = NPSSurvey(
        id=uuid.uuid4(),
        name="Q1 2026 NPS",
        quarter=1,
        year=2026,
        status="draft",
        questions=[{"type": "nps", "text": "How likely are you to recommend AMG?"}],
        created_by=md_user.id,
    )
    db_session.add(survey)
    await db_session.commit()
    return survey


@pytest_asyncio.fixture
async def active_survey(
    db_session: AsyncSession,
    md_user: User,
) -> NPSSurvey:
    """An active NPS survey open for responses."""
    survey = NPSSurvey(
        id=uuid.uuid4(),
        name="Active NPS",
        quarter=2,
        year=2026,
        status="active",
        questions=[{"type": "nps", "text": "Rate us"}],
        created_by=md_user.id,
        closes_at=datetime(2026, 6, 30, tzinfo=UTC),
    )
    db_session.add(survey)
    await db_session.commit()
    return survey


@pytest_asyncio.fixture
async def client_profile_for_nps(
    db_session: AsyncSession,
    rm_user: User,
    client_user: User,
) -> ClientProfile:
    """A client profile linked to client_user for NPS response submission."""
    profile = ClientProfile(
        id=uuid.uuid4(),
        legal_name="NPS Test Client",
        primary_email="nps@test.local",
        compliance_status="cleared",
        approval_status="approved",
        created_by=rm_user.id,
        assigned_rm_id=rm_user.id,
        user_id=client_user.id,
    )
    db_session.add(profile)
    await db_session.commit()
    return profile


# ---------------------------------------------------------------------------
# Create Survey
# ---------------------------------------------------------------------------


class TestCreateSurvey:
    async def test_rm_creates_survey(self, rm_client: AsyncClient) -> None:
        resp = await rm_client.post(
            BASE + "/",
            json={
                "name": "Test Survey",
                "quarter": 3,
                "year": 2026,
                "questions": [{"type": "nps", "text": "Rate us"}],
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Test Survey"

    async def test_client_cannot_create(self, client_user_http: AsyncClient) -> None:
        resp = await client_user_http.post(
            BASE + "/",
            json={
                "name": "Blocked",
                "quarter": 3,
                "year": 2026,
                "questions": [{"type": "nps", "text": "Rate us"}],
            },
        )
        assert resp.status_code == 403

    async def test_unauthenticated_returns_401(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.post(
            BASE + "/",
            json={
                "name": "Blocked",
                "quarter": 3,
                "year": 2026,
                "questions": [{"type": "nps", "text": "Rate us"}],
            },
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# List Surveys
# ---------------------------------------------------------------------------


class TestListSurveys:
    async def test_internal_can_list(
        self,
        rm_client: AsyncClient,
        nps_survey: NPSSurvey,
    ) -> None:
        resp = await rm_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()
        assert "surveys" in data
        assert data["total"] >= 1

    async def test_filter_by_year(
        self,
        rm_client: AsyncClient,
        nps_survey: NPSSurvey,
    ) -> None:
        resp = await rm_client.get(BASE + "/", params={"year": 2026})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1

    async def test_client_cannot_list(self, client_user_http: AsyncClient) -> None:
        resp = await client_user_http.get(BASE + "/")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Survey Lifecycle
# ---------------------------------------------------------------------------


class TestSurveyLifecycle:
    async def test_activate_survey(
        self,
        rm_client: AsyncClient,
        nps_survey: NPSSurvey,
    ) -> None:
        resp = await rm_client.post(f"{BASE}/{nps_survey.id}/activate")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "active"

    async def test_close_survey(
        self,
        rm_client: AsyncClient,
        active_survey: NPSSurvey,
    ) -> None:
        resp = await rm_client.post(f"{BASE}/{active_survey.id}/close")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "closed"

    async def test_cannot_activate_active(
        self,
        rm_client: AsyncClient,
        active_survey: NPSSurvey,
    ) -> None:
        resp = await rm_client.post(f"{BASE}/{active_survey.id}/activate")
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Submit Response
# ---------------------------------------------------------------------------


class TestSubmitResponse:
    async def test_client_submits_response(
        self,
        client_user_http: AsyncClient,
        active_survey: NPSSurvey,
        client_profile_for_nps: ClientProfile,
    ) -> None:
        resp = await client_user_http.post(
            f"{BASE}/{active_survey.id}/responses",
            json={
                "score": 9,
                "comment": "Excellent service",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["score"] == 9

    async def test_inactive_survey_rejected(
        self,
        client_user_http: AsyncClient,
        nps_survey: NPSSurvey,
        client_profile_for_nps: ClientProfile,
    ) -> None:
        resp = await client_user_http.post(
            f"{BASE}/{nps_survey.id}/responses",
            json={
                "score": 7,
                "comment": "Should fail",
            },
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Survey Stats
# ---------------------------------------------------------------------------


class TestSurveyStats:
    async def test_get_stats(
        self,
        rm_client: AsyncClient,
        active_survey: NPSSurvey,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/{active_survey.id}/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_responses" in data or "survey_id" in data
