"""Tests for /api/v1/clearance-certificates (compliance certificate) endpoints."""

from __future__ import annotations

import uuid

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clearance_certificate import (
    CertificateTemplate,
    ClearanceCertificate,
)
from app.models.client import Client
from app.models.program import Program
from app.models.user import User

BASE = "/api/v1/clearance-certificates"


# ---------------------------------------------------------------------------
# Local fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def cert_program(
    db_session: AsyncSession,
    db_client: Client,
    rm_user: User,
) -> Program:
    """A completed program used for certificate tests."""
    program = Program(
        id=uuid.uuid4(),
        client_id=db_client.id,
        title="Cert Test Program",
        status="completed",
        created_by=rm_user.id,
    )
    db_session.add(program)
    await db_session.commit()
    return program


@pytest_asyncio.fixture
async def cert_template(
    db_session: AsyncSession,
    compliance_user: User,
) -> CertificateTemplate:
    """A certificate template."""
    template = CertificateTemplate(
        id=uuid.uuid4(),
        name="Program Clearance",
        template_type="program",
        content="Certificate for {{program_title}}",
        placeholders={"program_title": "Program title"},
        is_active=True,
        created_by=compliance_user.id,
    )
    db_session.add(template)
    await db_session.commit()
    return template


@pytest_asyncio.fixture
async def draft_certificate(
    db_session: AsyncSession,
    cert_program: Program,
    db_client: Client,
    compliance_user: User,
) -> ClearanceCertificate:
    """A draft clearance certificate."""
    cert = ClearanceCertificate(
        id=uuid.uuid4(),
        certificate_number="CERT-TEST-001",
        program_id=cert_program.id,
        client_id=db_client.id,
        title="Test Certificate",
        content="Clearance granted",
        certificate_type="program_completion",
        status="draft",
        created_by=compliance_user.id,
    )
    db_session.add(cert)
    await db_session.commit()
    return cert


# ---------------------------------------------------------------------------
# Certificate Templates
# ---------------------------------------------------------------------------


class TestCertificateTemplates:
    async def test_compliance_creates_template(self, compliance_client: AsyncClient) -> None:
        resp = await compliance_client.post(
            f"{BASE}/templates",
            json={
                "name": "New Template",
                "template_type": "program",
                "content": "Template content",
                "is_active": True,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "New Template"

    async def test_list_templates(
        self,
        compliance_client: AsyncClient,
        cert_template: CertificateTemplate,
    ) -> None:
        resp = await compliance_client.get(f"{BASE}/templates")
        assert resp.status_code == 200
        data = resp.json()
        assert "templates" in data
        assert data["total"] >= 1

    async def test_get_template(
        self,
        compliance_client: AsyncClient,
        cert_template: CertificateTemplate,
    ) -> None:
        resp = await compliance_client.get(f"{BASE}/templates/{cert_template.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(cert_template.id)

    async def test_rm_cannot_create_template(self, rm_client: AsyncClient) -> None:
        resp = await rm_client.post(
            f"{BASE}/templates",
            json={
                "name": "Blocked",
                "template_type": "program",
                "content": "Should fail",
                "is_active": True,
            },
        )
        assert resp.status_code == 403

    async def test_client_cannot_create(self, client_user_http: AsyncClient) -> None:
        resp = await client_user_http.post(
            f"{BASE}/templates",
            json={
                "name": "Blocked",
                "template_type": "program",
                "content": "Should fail",
                "is_active": True,
            },
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Create Certificate
# ---------------------------------------------------------------------------


class TestCreateCertificate:
    async def test_compliance_creates_certificate(
        self,
        compliance_client: AsyncClient,
        db_client: Client,
        cert_program: Program,
    ) -> None:
        resp = await compliance_client.post(
            BASE + "/",
            json={
                "client_id": str(db_client.id),
                "program_id": str(cert_program.id),
                "title": "New Cert",
                "content": "Content",
                "certificate_type": "program_completion",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "New Cert"
        assert data["status"] == "draft"

    async def test_rm_cannot_create(
        self,
        rm_client: AsyncClient,
        db_client: Client,
        cert_program: Program,
    ) -> None:
        resp = await rm_client.post(
            BASE + "/",
            json={
                "client_id": str(db_client.id),
                "program_id": str(cert_program.id),
                "title": "Blocked",
                "content": "Should fail",
                "certificate_type": "program_completion",
            },
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Certificate Operations
# ---------------------------------------------------------------------------


class TestCertificateOperations:
    async def test_list_certificates(
        self,
        compliance_client: AsyncClient,
        draft_certificate: ClearanceCertificate,
    ) -> None:
        resp = await compliance_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()
        assert "certificates" in data
        assert data["total"] >= 1

    async def test_get_certificate(
        self,
        compliance_client: AsyncClient,
        draft_certificate: ClearanceCertificate,
    ) -> None:
        resp = await compliance_client.get(f"{BASE}/{draft_certificate.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(draft_certificate.id)

    async def test_update_draft_certificate(
        self,
        compliance_client: AsyncClient,
        draft_certificate: ClearanceCertificate,
    ) -> None:
        resp = await compliance_client.patch(
            f"{BASE}/{draft_certificate.id}",
            json={"title": "Updated Title"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Updated Title"

    async def test_delete_draft_certificate(
        self,
        compliance_client: AsyncClient,
        draft_certificate: ClearanceCertificate,
    ) -> None:
        resp = await compliance_client.delete(f"{BASE}/{draft_certificate.id}")
        assert resp.status_code == 204


# ---------------------------------------------------------------------------
# Issue Certificate
# ---------------------------------------------------------------------------


class TestIssueCertificate:
    async def test_compliance_issues_certificate(
        self,
        compliance_client: AsyncClient,
        draft_certificate: ClearanceCertificate,
    ) -> None:
        resp = await compliance_client.post(
            f"{BASE}/{draft_certificate.id}/issue",
            json={
                "issue_date": "2026-03-17",
                "expiry_date": "2027-03-17",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "issued"
