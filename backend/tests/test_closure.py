"""Tests for /api/v1/programs/{program_id}/closure (program closure workflow) endpoints."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.partner import PartnerProfile
from app.models.program import Program
from app.models.program_closure import ProgramClosure
from app.models.user import User

BASE = "/api/v1/programs"


def _checklist(overrides: dict[str, bool] | None = None) -> list[dict[str, Any]]:
    """Build the standard five-item closure checklist.

    *overrides* maps checklist key → completed flag.
    """
    items = [
        ("deliverables_approved", "All deliverables approved"),
        ("partner_ratings_submitted", "Partner ratings submitted"),
        ("final_report_generated", "Final report generated"),
        ("client_signoff", "Client sign-off received"),
        ("financials_reconciled", "Financials reconciled"),
    ]
    flags = overrides or {}
    return [
        {"key": k, "label": lbl, "completed": flags.get(k, False)}
        for k, lbl in items
    ]


# ---------------------------------------------------------------------------
# Local fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def completed_program(
    db_session: AsyncSession,
    db_client: Client,
    rm_user: User,
) -> Program:
    """A Program in ``completed`` status suitable for closure."""
    program = Program(
        id=uuid.uuid4(),
        client_id=db_client.id,
        title="Completed Program for Closure",
        status="completed",
        budget_envelope=250_000,
        created_by=rm_user.id,
        start_date=date(2025, 6, 1),
    )
    db_session.add(program)
    await db_session.commit()
    return program


@pytest_asyncio.fixture
async def closure(
    db_session: AsyncSession,
    completed_program: Program,
    rm_user: User,
) -> ProgramClosure:
    """An existing closure record in ``initiated`` status."""
    record = ProgramClosure(
        id=uuid.uuid4(),
        program_id=completed_program.id,
        status="initiated",
        initiated_by=rm_user.id,
        checklist=_checklist(),
        notes="Initial closure notes",
    )
    db_session.add(record)
    await db_session.commit()
    return record


@pytest_asyncio.fixture
async def partner_for_rating(
    db_session: AsyncSession,
    md_user: User,
) -> PartnerProfile:
    """A partner profile for rating tests."""
    profile = PartnerProfile(
        id=uuid.uuid4(),
        firm_name="Rating Test Partners",
        contact_name="Rating Contact",
        contact_email="rating@test.local",
        capabilities=["legal_advisory"],
        geographies=["APAC"],
        status="active",
        compliance_verified=True,
        created_by=md_user.id,
    )
    db_session.add(profile)
    await db_session.commit()
    return profile


@pytest_asyncio.fixture
async def fresh_completed_program(
    db_session: AsyncSession,
    db_client: Client,
    rm_user: User,
) -> Program:
    """A completed program with NO existing closure — for initiation tests."""
    program = Program(
        id=uuid.uuid4(),
        client_id=db_client.id,
        title="Fresh Completed Program",
        status="completed",
        budget_envelope=150_000,
        created_by=rm_user.id,
        start_date=date(2025, 9, 1),
    )
    db_session.add(program)
    await db_session.commit()
    return program


# ---------------------------------------------------------------------------
# Initiate closure
# ---------------------------------------------------------------------------


class TestInitiateClosure:
    async def test_rm_initiates_closure(
        self,
        rm_client: AsyncClient,
        fresh_completed_program: Program,
    ) -> None:
        resp = await rm_client.post(
            f"{BASE}/{fresh_completed_program.id}/closure",
            json={
                "program_id": str(fresh_completed_program.id),
                "notes": "Starting closure",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "initiated"
        assert data["program_id"] == str(fresh_completed_program.id)

    async def test_client_cannot_initiate(
        self,
        client_user_http: AsyncClient,
        fresh_completed_program: Program,
    ) -> None:
        resp = await client_user_http.post(
            f"{BASE}/{fresh_completed_program.id}/closure",
            json={
                "program_id": str(fresh_completed_program.id),
                "notes": "Should not work",
            },
        )
        assert resp.status_code == 403

    async def test_unauthenticated_returns_401(
        self,
        anon_client: AsyncClient,
        fresh_completed_program: Program,
    ) -> None:
        resp = await anon_client.post(
            f"{BASE}/{fresh_completed_program.id}/closure",
            json={
                "program_id": str(fresh_completed_program.id),
                "notes": "No auth",
            },
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Get closure status
# ---------------------------------------------------------------------------


class TestGetClosure:
    async def test_rm_gets_closure_status(
        self,
        rm_client: AsyncClient,
        completed_program: Program,
        closure: ProgramClosure,
    ) -> None:
        resp = await rm_client.get(
            f"{BASE}/{completed_program.id}/closure"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "initiated"

    async def test_nonexistent_returns_404(
        self,
        rm_client: AsyncClient,
    ) -> None:
        fake_id = uuid.uuid4()
        resp = await rm_client.get(f"{BASE}/{fake_id}/closure")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Update checklist
# ---------------------------------------------------------------------------


class TestUpdateChecklist:
    async def test_rm_updates_checklist(
        self,
        rm_client: AsyncClient,
        completed_program: Program,
        closure: ProgramClosure,
    ) -> None:
        updated = _checklist({"deliverables_approved": True})
        resp = await rm_client.patch(
            f"{BASE}/{completed_program.id}/closure/checklist",
            json={"items": updated},
        )
        assert resp.status_code == 200
        data = resp.json()
        checklist = data["checklist"]
        approved_item = next(
            (c for c in checklist if c["key"] == "deliverables_approved"),
            None,
        )
        assert approved_item is not None
        assert approved_item["completed"] is True


# ---------------------------------------------------------------------------
# Partner ratings
# ---------------------------------------------------------------------------


class TestPartnerRatings:
    async def test_rm_submits_rating(
        self,
        rm_client: AsyncClient,
        completed_program: Program,
        closure: ProgramClosure,
        partner_for_rating: PartnerProfile,
    ) -> None:
        resp = await rm_client.post(
            f"{BASE}/{completed_program.id}/closure/partner-ratings",
            json={
                "partner_id": str(partner_for_rating.id),
                "quality_score": 4,
                "timeliness_score": 5,
                "communication_score": 4,
                "overall_score": 4,
                "comments": "Excellent work",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["quality_score"] == 4
        assert data["partner_id"] == str(partner_for_rating.id)

    async def test_rm_lists_ratings(
        self,
        rm_client: AsyncClient,
        completed_program: Program,
        closure: ProgramClosure,
    ) -> None:
        resp = await rm_client.get(
            f"{BASE}/{completed_program.id}/closure/partner-ratings"
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


# ---------------------------------------------------------------------------
# Debrief notes
# ---------------------------------------------------------------------------


class TestDebriefNotes:
    async def test_rm_saves_debrief(
        self,
        rm_client: AsyncClient,
        completed_program: Program,
        closure: ProgramClosure,
    ) -> None:
        resp = await rm_client.patch(
            f"{BASE}/{completed_program.id}/closure/debrief-notes",
            json={"notes": "Debrief content"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["debrief_notes"] == "Debrief content"


# ---------------------------------------------------------------------------
# Complete closure
# ---------------------------------------------------------------------------


class TestCompleteClosure:
    async def test_complete_closure(
        self,
        rm_client: AsyncClient,
        completed_program: Program,
        closure: ProgramClosure,
    ) -> None:
        # First mark all checklist items as completed
        all_done = _checklist({
            "deliverables_approved": True,
            "partner_ratings_submitted": True,
            "final_report_generated": True,
            "client_signoff": True,
            "financials_reconciled": True,
        })
        checklist_resp = await rm_client.patch(
            f"{BASE}/{completed_program.id}/closure/checklist",
            json={"items": all_done},
        )
        assert checklist_resp.status_code == 200

        resp = await rm_client.post(
            f"{BASE}/{completed_program.id}/closure/complete"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"
        assert data["completed_at"] is not None
