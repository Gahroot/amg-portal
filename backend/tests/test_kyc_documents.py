"""Tests for /api/v1/kyc-documents endpoints."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.document import Document
from app.models.enums import KYCDocumentStatus, KYCDocumentType
from app.models.kyc_document import KYCDocument
from app.models.user import User

BASE = "/api/v1/kyc"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_kyc_document(
    db_session: AsyncSession,
    db_client: Client,
    rm_user: User,
) -> KYCDocument:
    """A KYCDocument record linked to db_client with an underlying Document."""
    doc = Document(
        id=uuid.uuid4(),
        entity_type="client",
        entity_id=db_client.id,
        category="compliance",
        file_path="/test/kyc_doc.pdf",
        file_name="kyc_doc.pdf",
        file_size=2048,
        content_type="application/pdf",
        version=1,
        uploaded_by=rm_user.id,
    )
    db_session.add(doc)
    await db_session.flush()

    kyc = KYCDocument(
        id=uuid.uuid4(),
        client_id=db_client.id,
        document_id=doc.id,
        document_type=KYCDocumentType.passport,
        status=KYCDocumentStatus.pending,
        expiry_date=date.today() + timedelta(days=365),
    )
    db_session.add(kyc)
    await db_session.commit()
    return kyc


@pytest_asyncio.fixture
async def test_kyc_document_expired(
    db_session: AsyncSession,
    db_client: Client,
    rm_user: User,
) -> KYCDocument:
    """An expired KYCDocument for testing expiry filtering."""
    doc = Document(
        id=uuid.uuid4(),
        entity_type="client",
        entity_id=db_client.id,
        category="compliance",
        file_path="/test/expired_kyc.pdf",
        file_name="expired_kyc.pdf",
        file_size=1024,
        content_type="application/pdf",
        version=1,
        uploaded_by=rm_user.id,
    )
    db_session.add(doc)
    await db_session.flush()

    kyc = KYCDocument(
        id=uuid.uuid4(),
        client_id=db_client.id,
        document_id=doc.id,
        document_type=KYCDocumentType.national_id,
        status=KYCDocumentStatus.verified,
        expiry_date=date.today() - timedelta(days=10),  # Expired 10 days ago
    )
    db_session.add(kyc)
    await db_session.commit()
    return kyc


@pytest_asyncio.fixture
async def test_kyc_document_expiring_soon(
    db_session: AsyncSession,
    db_client: Client,
    rm_user: User,
) -> KYCDocument:
    """A KYCDocument expiring within 7 days."""
    doc = Document(
        id=uuid.uuid4(),
        entity_type="client",
        entity_id=db_client.id,
        category="compliance",
        file_path="/test/expiring_kyc.pdf",
        file_name="expiring_kyc.pdf",
        file_size=1024,
        content_type="application/pdf",
        version=1,
        uploaded_by=rm_user.id,
    )
    db_session.add(doc)
    await db_session.flush()

    kyc = KYCDocument(
        id=uuid.uuid4(),
        client_id=db_client.id,
        document_id=doc.id,
        document_type=KYCDocumentType.proof_of_address,
        status=KYCDocumentStatus.verified,
        expiry_date=date.today() + timedelta(days=5),  # Expiring in 5 days
    )
    db_session.add(kyc)
    await db_session.commit()
    return kyc


# ---------------------------------------------------------------------------
# List KYC Documents
# ---------------------------------------------------------------------------


class TestListKYCDocuments:
    async def test_rm_can_list(
        self,
        rm_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/clients/{db_client.id}/kyc-documents")
        assert resp.status_code == 200
        data = resp.json()
        assert "kyc_documents" in data
        assert "total" in data
        assert data["total"] >= 1

    async def test_md_can_list(
        self,
        md_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await md_client.get(f"{BASE}/clients/{db_client.id}/kyc-documents")
        assert resp.status_code == 200
        data = resp.json()
        assert "kyc_documents" in data

    async def test_compliance_can_list(
        self,
        compliance_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await compliance_client.get(f"{BASE}/clients/{db_client.id}/kyc-documents")
        assert resp.status_code == 200
        data = resp.json()
        assert "kyc_documents" in data

    async def test_pagination(
        self,
        rm_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await rm_client.get(
            f"{BASE}/clients/{db_client.id}/kyc-documents",
            params={"skip": 0, "limit": 10},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["kyc_documents"]) <= 10

    async def test_nonexistent_client_returns_empty(
        self,
        rm_client: AsyncClient,
    ) -> None:
        fake_client_id = uuid.uuid4()
        resp = await rm_client.get(f"{BASE}/clients/{fake_client_id}/kyc-documents")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["kyc_documents"] == []

    async def test_client_cannot_list(
        self,
        client_user_http: AsyncClient,
        db_client: Client,
    ) -> None:
        resp = await client_user_http.get(f"{BASE}/clients/{db_client.id}/kyc-documents")
        assert resp.status_code == 403

    async def test_partner_cannot_list(
        self,
        partner_http: AsyncClient,
        db_client: Client,
    ) -> None:
        resp = await partner_http.get(f"{BASE}/clients/{db_client.id}/kyc-documents")
        assert resp.status_code == 403

    async def test_unauthenticated_returns_401(
        self,
        anon_client: AsyncClient,
        db_client: Client,
    ) -> None:
        resp = await anon_client.get(f"{BASE}/clients/{db_client.id}/kyc-documents")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Get KYC Document
# ---------------------------------------------------------------------------


class TestGetKYCDocument:
    async def test_rm_can_get(
        self,
        rm_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await rm_client.get(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(test_kyc_document.id)
        assert data["client_id"] == str(db_client.id)
        assert data["document_type"] == KYCDocumentType.passport
        assert data["status"] == KYCDocumentStatus.pending
        assert "document" in data
        assert data["document"] is not None

    async def test_md_can_get(
        self,
        md_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await md_client.get(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}"
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == str(test_kyc_document.id)

    async def test_compliance_can_get(
        self,
        compliance_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await compliance_client.get(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}"
        )
        assert resp.status_code == 200

    async def test_nonexistent_returns_404(
        self,
        rm_client: AsyncClient,
        db_client: Client,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/clients/{db_client.id}/kyc-documents/{uuid.uuid4()}")
        assert resp.status_code == 404

    async def test_wrong_client_returns_404(
        self,
        rm_client: AsyncClient,
        test_kyc_document: KYCDocument,
    ) -> None:
        """KYC doc exists but under different client_id."""
        other_client_id = uuid.uuid4()
        resp = await rm_client.get(
            f"{BASE}/clients/{other_client_id}/kyc-documents/{test_kyc_document.id}"
        )
        assert resp.status_code == 404

    async def test_client_cannot_get(
        self,
        client_user_http: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await client_user_http.get(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}"
        )
        assert resp.status_code == 403

    async def test_unauthenticated_returns_401(
        self,
        anon_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await anon_client.get(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}"
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Create KYC Document
# ---------------------------------------------------------------------------


class TestCreateKYCDocument:
    async def test_create_requires_auth(
        self,
        anon_client: AsyncClient,
        db_client: Client,
    ) -> None:
        resp = await anon_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents",
            data={"document_type": "passport"},
            files={"file": ("test.pdf", b"fake content", "application/pdf")},
        )
        assert resp.status_code == 401

    async def test_client_cannot_create(
        self,
        client_user_http: AsyncClient,
        db_client: Client,
    ) -> None:
        resp = await client_user_http.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents",
            data={"document_type": "passport"},
            files={"file": ("test.pdf", b"fake content", "application/pdf")},
        )
        assert resp.status_code == 403

    async def test_partner_cannot_create(
        self,
        partner_http: AsyncClient,
        db_client: Client,
    ) -> None:
        resp = await partner_http.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents",
            data={"document_type": "passport"},
            files={"file": ("test.pdf", b"fake content", "application/pdf")},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Upload KYC Document
# ---------------------------------------------------------------------------


class TestUploadKYCDocument:
    async def test_rm_can_upload(
        self,
        rm_client: AsyncClient,
        db_client: Client,
    ) -> None:
        resp = await rm_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents",
            data={
                "document_type": "passport",
                "expiry_date": "2025-12-31",
                "notes": "Test upload",
            },
            files={"file": ("passport.pdf", b"%PDF-1.4 fake content", "application/pdf")},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["document_type"] == "passport"
        assert data["status"] == "pending"
        assert data["expiry_date"] == "2025-12-31"
        assert data["notes"] == "Test upload"
        assert "document" in data
        assert data["document"]["file_name"] == "passport.pdf"

    async def test_md_can_upload(
        self,
        md_client: AsyncClient,
        db_client: Client,
    ) -> None:
        resp = await md_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents",
            data={"document_type": "national_id"},
            files={"file": ("national_id.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
        )
        assert resp.status_code == 201
        assert resp.json()["document_type"] == "national_id"

    async def test_coordinator_can_upload(
        self,
        coordinator_client: AsyncClient,
        db_client: Client,
    ) -> None:
        resp = await coordinator_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents",
            data={"document_type": "proof_of_address"},
            files={"file": ("address.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
        )
        assert resp.status_code == 201

    async def test_upload_to_nonexistent_client_returns_404(
        self,
        rm_client: AsyncClient,
    ) -> None:
        fake_client_id = uuid.uuid4()
        resp = await rm_client.post(
            f"{BASE}/clients/{fake_client_id}/kyc-documents",
            data={"document_type": "passport"},
            files={"file": ("test.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
        )
        assert resp.status_code == 404

    async def test_upload_without_file_returns_422(
        self,
        rm_client: AsyncClient,
        db_client: Client,
    ) -> None:
        resp = await rm_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents",
            data={"document_type": "passport"},
        )
        assert resp.status_code == 422

    async def test_upload_without_document_type_returns_422(
        self,
        rm_client: AsyncClient,
        db_client: Client,
    ) -> None:
        resp = await rm_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents",
            files={"file": ("test.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
        )
        assert resp.status_code == 422

    async def test_upload_requires_auth(
        self,
        anon_client: AsyncClient,
        db_client: Client,
    ) -> None:
        resp = await anon_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents",
            data={"document_type": "passport"},
            files={"file": ("test.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
        )
        assert resp.status_code == 401

    async def test_client_cannot_upload(
        self,
        client_user_http: AsyncClient,
        db_client: Client,
    ) -> None:
        resp = await client_user_http.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents",
            data={"document_type": "passport"},
            files={"file": ("test.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
        )
        assert resp.status_code == 403

    async def test_partner_cannot_upload(
        self,
        partner_http: AsyncClient,
        db_client: Client,
    ) -> None:
        resp = await partner_http.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents",
            data={"document_type": "passport"},
            files={"file": ("test.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Update KYC Document (via verify endpoint)
# ---------------------------------------------------------------------------


class TestUpdateKYCDocument:
    async def test_update_notes_via_verify(
        self,
        rm_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await rm_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}/verify",
            json={"status": "verified", "notes": "Updated notes"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["notes"] == "Updated notes"
        assert data["status"] == "verified"


# ---------------------------------------------------------------------------
# Delete KYC Document
# ---------------------------------------------------------------------------


class TestDeleteKYCDocument:
    """Note: The current API does not expose a DELETE endpoint for KYC documents.

    Deletion would typically cascade from the underlying Document deletion.
    These tests document expected RBAC behavior if a delete endpoint is added.
    """

    async def test_client_cannot_delete_via_documents(
        self,
        client_user_http: AsyncClient,
        test_kyc_document: KYCDocument,
    ) -> None:
        """Client cannot delete the underlying document either."""
        resp = await client_user_http.delete(f"/api/v1/documents/{test_kyc_document.document_id}")
        assert resp.status_code == 403

    async def test_partner_cannot_delete_via_documents(
        self,
        partner_http: AsyncClient,
        test_kyc_document: KYCDocument,
    ) -> None:
        """Partner cannot delete the underlying document."""
        resp = await partner_http.delete(f"/api/v1/documents/{test_kyc_document.document_id}")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# KYC Status Transitions
# ---------------------------------------------------------------------------


class TestKYCStatusTransitions:
    async def test_verify_pending_document(
        self,
        rm_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await rm_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}/verify",
            json={"status": "verified"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "verified"
        assert data["verified_by"] is not None
        assert data["verified_at"] is not None

    async def test_reject_document(
        self,
        rm_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await rm_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}/verify",
            json={"status": "rejected", "rejection_reason": "Image quality too low"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "rejected"
        assert data["rejection_reason"] == "Image quality too low"

    async def test_compliance_can_verify(
        self,
        compliance_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await compliance_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}/verify",
            json={"status": "verified", "notes": "Compliance approved"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "verified"

    async def test_md_can_verify(
        self,
        md_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await md_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}/verify",
            json={"status": "verified"},
        )
        assert resp.status_code == 200

    async def test_invalid_status_returns_400(
        self,
        rm_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await rm_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}/verify",
            json={"status": "invalid_status"},
        )
        assert resp.status_code == 400

    async def test_client_cannot_verify(
        self,
        client_user_http: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await client_user_http.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}/verify",
            json={"status": "verified"},
        )
        assert resp.status_code == 403

    async def test_partner_cannot_verify(
        self,
        partner_http: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await partner_http.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}/verify",
            json={"status": "verified"},
        )
        assert resp.status_code == 403

    async def test_unauthenticated_verify_returns_401(
        self,
        anon_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        resp = await anon_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}/verify",
            json={"status": "verified"},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Expiring KYC Documents
# ---------------------------------------------------------------------------


class TestExpiringKYCDocuments:
    async def test_list_expiring(
        self,
        rm_client: AsyncClient,
        test_kyc_document_expiring_soon: KYCDocument,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/kyc-documents/expiring", params={"days": 30})
        assert resp.status_code == 200
        data = resp.json()
        assert "kyc_documents" in data
        assert "total" in data
        assert data["total"] >= 1

    async def test_list_expiring_with_days_filter(
        self,
        rm_client: AsyncClient,
        test_kyc_document_expiring_soon: KYCDocument,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/kyc-documents/expiring", params={"days": 7})
        assert resp.status_code == 200
        data = resp.json()
        # Document expiring in 5 days should be included
        assert data["total"] >= 1

    async def test_expiry_summary(
        self,
        rm_client: AsyncClient,
        test_kyc_document_expired: KYCDocument,
        test_kyc_document_expiring_soon: KYCDocument,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/kyc-documents/expiry-summary")
        assert resp.status_code == 200
        data = resp.json()
        assert "expired" in data
        assert "urgent" in data
        assert "warning" in data
        assert "total" in data
        assert data["expired"] >= 1  # test_kyc_document_expired
        assert data["urgent"] >= 1  # test_kyc_document_expiring_soon (5 days)

    async def test_client_cannot_access_expiring(
        self,
        client_user_http: AsyncClient,
    ) -> None:
        resp = await client_user_http.get(f"{BASE}/kyc-documents/expiring")
        assert resp.status_code == 403

    async def test_partner_cannot_access_expiring(
        self,
        partner_http: AsyncClient,
    ) -> None:
        resp = await partner_http.get(f"{BASE}/kyc-documents/expiring")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# RBAC Tests
# ---------------------------------------------------------------------------


class TestKYCRBAC:
    """Role-based access control tests for KYC document endpoints."""

    async def test_md_has_full_access(
        self,
        md_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        """Managing Director should have full access to all KYC operations."""
        # List
        resp = await md_client.get(f"{BASE}/clients/{db_client.id}/kyc-documents")
        assert resp.status_code == 200

        # Get
        resp = await md_client.get(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}"
        )
        assert resp.status_code == 200

        # Upload
        resp = await md_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents",
            data={"document_type": "tax_id"},
            files={"file": ("tax.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
        )
        assert resp.status_code == 201

        # Verify
        resp = await md_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}/verify",
            json={"status": "verified"},
        )
        assert resp.status_code == 200

    async def test_compliance_has_full_access(
        self,
        compliance_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        """Finance/Compliance should have full access to KYC operations."""
        # List
        resp = await compliance_client.get(f"{BASE}/clients/{db_client.id}/kyc-documents")
        assert resp.status_code == 200

        # Get
        resp = await compliance_client.get(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}"
        )
        assert resp.status_code == 200

        # Upload
        resp = await compliance_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents",
            data={"document_type": "bank_statement"},
            files={"file": ("bank.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
        )
        assert resp.status_code == 201

        # Verify
        resp = await compliance_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}/verify",
            json={"status": "verified"},
        )
        assert resp.status_code == 200

    async def test_coordinator_has_limited_access(
        self,
        coordinator_client: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        """Coordinator can upload but may not verify."""
        # List
        resp = await coordinator_client.get(f"{BASE}/clients/{db_client.id}/kyc-documents")
        assert resp.status_code == 200

        # Get
        resp = await coordinator_client.get(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}"
        )
        assert resp.status_code == 200

        # Upload
        resp = await coordinator_client.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents",
            data={"document_type": "source_of_wealth"},
            files={"file": ("wealth.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
        )
        assert resp.status_code == 201

    async def test_client_role_denied_all_operations(
        self,
        client_user_http: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        """Client role should be denied access to all KYC endpoints."""
        # List
        resp = await client_user_http.get(f"{BASE}/clients/{db_client.id}/kyc-documents")
        assert resp.status_code == 403

        # Get
        resp = await client_user_http.get(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}"
        )
        assert resp.status_code == 403

        # Upload
        resp = await client_user_http.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents",
            data={"document_type": "passport"},
            files={"file": ("test.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
        )
        assert resp.status_code == 403

        # Verify
        resp = await client_user_http.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}/verify",
            json={"status": "verified"},
        )
        assert resp.status_code == 403

        # Expiring
        resp = await client_user_http.get(f"{BASE}/kyc-documents/expiring")
        assert resp.status_code == 403

    async def test_partner_role_denied_all_operations(
        self,
        partner_http: AsyncClient,
        db_client: Client,
        test_kyc_document: KYCDocument,
    ) -> None:
        """Partner role should be denied access to all KYC endpoints."""
        # List
        resp = await partner_http.get(f"{BASE}/clients/{db_client.id}/kyc-documents")
        assert resp.status_code == 403

        # Get
        resp = await partner_http.get(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}"
        )
        assert resp.status_code == 403

        # Upload
        resp = await partner_http.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents",
            data={"document_type": "passport"},
            files={"file": ("test.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
        )
        assert resp.status_code == 403

        # Verify
        resp = await partner_http.post(
            f"{BASE}/clients/{db_client.id}/kyc-documents/{test_kyc_document.id}/verify",
            json={"status": "verified"},
        )
        assert resp.status_code == 403
