"""DocuSign integration service using the DocuSign REST API via httpx.

Supports JWT Grant authentication (server-to-server) and graceful
degradation when DocuSign credentials are not configured.
"""

import hashlib
import hmac
import logging
import time
from datetime import UTC, datetime
from uuid import UUID

import httpx
import jwt as pyjwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.envelope import Envelope
from app.schemas.envelope import (
    EnvelopeCreateRequest,
    EnvelopeListResponse,
    EnvelopeResponse,
    EnvelopeSigningSessionResponse,
)

logger = logging.getLogger(__name__)

# DocuSign REST API v2.1 paths
_API_PREFIX = "/v2.1/accounts"

# Token lifetime: 1 hour.  Refresh 5 min before expiry.
_TOKEN_LIFETIME_SECONDS = 3600
_TOKEN_REFRESH_MARGIN_SECONDS = 300


class DocuSignNotConfiguredError(Exception):
    """Raised when DocuSign credentials are missing."""


class DocuSignService:
    """Handles communication with DocuSign REST API and local envelope records."""

    def __init__(self) -> None:
        self.base_url = settings.DOCUSIGN_BASE_URL
        self.account_id = settings.DOCUSIGN_ACCOUNT_ID
        self.integration_key = settings.DOCUSIGN_INTEGRATION_KEY
        self.secret_key = settings.DOCUSIGN_SECRET_KEY
        self.user_id = settings.DOCUSIGN_USER_ID
        self.rsa_private_key = settings.DOCUSIGN_RSA_PRIVATE_KEY
        self.oauth_base_url = settings.DOCUSIGN_OAUTH_BASE_URL
        self.webhook_secret = settings.DOCUSIGN_WEBHOOK_SECRET

        # Token cache
        self._cached_token: str | None = None
        self._token_expires_at: float = 0.0

    # ------------------------------------------------------------------
    # Configuration check
    # ------------------------------------------------------------------

    def is_configured(self) -> bool:
        """Return True when all required DocuSign settings are present."""
        return bool(
            self.integration_key
            and self.account_id
            and self.user_id
            and self.rsa_private_key
        )

    def _require_configured(self) -> None:
        if not self.is_configured():
            raise DocuSignNotConfiguredError(
                "DocuSign integration is not configured. "
                "Set DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_ACCOUNT_ID, "
                "DOCUSIGN_USER_ID, and DOCUSIGN_RSA_PRIVATE_KEY."
            )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _account_url(self, path: str) -> str:
        return f"{self.base_url}{_API_PREFIX}/{self.account_id}{path}"

    def _oauth_host(self) -> str:
        """Extract the hostname from the OAuth base URL for JWT audience."""
        return self.oauth_base_url.replace("https://", "").replace("http://", "")

    async def _get_access_token(self) -> str:
        """Obtain an OAuth2 access token using JWT Grant.

        DocuSign JWT Grant flow:
        1. Build a JWT assertion signed with the RSA private key.
        2. POST to /oauth/token with grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
        3. Receive an access_token in response.
        """
        now = time.time()
        if self._cached_token and now < self._token_expires_at - _TOKEN_REFRESH_MARGIN_SECONDS:
            return self._cached_token

        # Build JWT assertion
        now_int = int(now)
        claims = {
            "iss": self.integration_key,
            "sub": self.user_id,
            "aud": self._oauth_host(),
            "iat": now_int,
            "exp": now_int + _TOKEN_LIFETIME_SECONDS,
            "scope": "signature impersonation",
        }

        # Decode escaped newlines in the PEM key
        private_key = self.rsa_private_key.replace("\\n", "\n")
        assertion = pyjwt.encode(claims, private_key, algorithm="RS256")

        url = f"{self.oauth_base_url}/oauth/token"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                url,
                data={
                    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    "assertion": assertion,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        token: str = data["access_token"]
        self._cached_token = token
        self._token_expires_at = now + data.get("expires_in", _TOKEN_LIFETIME_SECONDS)
        return token

    async def _authed_client(self) -> tuple[httpx.AsyncClient, dict[str, str]]:
        """Return an httpx client and auth headers."""
        token = await self._get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        return httpx.AsyncClient(timeout=30), headers

    # ------------------------------------------------------------------
    # Envelope CRUD
    # ------------------------------------------------------------------

    async def create_envelope(
        self,
        db: AsyncSession,
        request: EnvelopeCreateRequest,
        user_id: UUID,
        user_name: str,
        user_email: str,
    ) -> EnvelopeResponse:
        """Create an envelope in DocuSign and persist a local record."""
        self._require_configured()

        client, headers = await self._authed_client()

        signers = []
        for idx, r in enumerate(request.recipients, start=1):
            signers.append(
                {
                    "email": r.email,
                    "name": r.name,
                    "recipientId": str(idx),
                    "clientUserId": str(idx),
                }
            )

        payload = {
            "emailSubject": request.subject,
            "status": "sent",
            "recipients": {"signers": signers},
        }

        async with client:
            resp = await client.post(
                self._account_url("/envelopes"),
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        envelope = Envelope(
            document_id=request.document_id,
            envelope_id=data["envelopeId"],
            status=data.get("status", "sent"),
            subject=request.subject,
            recipients=[r.model_dump(mode="json") for r in request.recipients],
            sender_name=user_name,
            sender_email=user_email,
            created_by=user_id,
            sent_at=datetime.now(UTC),
        )
        db.add(envelope)
        await db.commit()
        await db.refresh(envelope)
        return EnvelopeResponse.model_validate(envelope)

    async def get_envelope(
        self, db: AsyncSession, envelope_pk: UUID
    ) -> Envelope | None:
        """Get a local envelope record by primary key."""
        result = await db.execute(
            select(Envelope).where(Envelope.id == envelope_pk)
        )
        return result.scalar_one_or_none()

    async def list_envelopes(
        self,
        db: AsyncSession,
        *,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> EnvelopeListResponse:
        """List local envelope records with optional status filter."""
        from sqlalchemy import func as sa_func

        query = select(Envelope)
        count_query = select(sa_func.count()).select_from(Envelope)

        if status:
            query = query.where(Envelope.status == status)
            count_query = count_query.where(Envelope.status == status)

        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        query = query.offset(skip).limit(limit).order_by(Envelope.created_at.desc())
        result = await db.execute(query)
        envelopes = result.scalars().all()

        return EnvelopeListResponse(
            envelopes=[EnvelopeResponse.model_validate(e) for e in envelopes],
            total=total,
        )

    async def list_envelopes_for_email(
        self,
        db: AsyncSession,
        email: str,
        *,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> EnvelopeListResponse:
        """List envelopes where the given email is a recipient."""
        from sqlalchemy import cast
        from sqlalchemy import func as sa_func
        from sqlalchemy.dialects.postgresql import JSONB

        # Filter envelopes whose recipients JSON array contains an entry with matching email.
        # recipients is a JSON column: [{"email": "...", ...}, ...]
        email_filter = Envelope.recipients.op("@>")(
            cast(f'[{{"email": "{email}"}}]', JSONB)
        )

        query = select(Envelope).where(email_filter)
        count_query = select(sa_func.count()).select_from(Envelope).where(email_filter)

        if status:
            query = query.where(Envelope.status == status)
            count_query = count_query.where(Envelope.status == status)

        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        query = query.offset(skip).limit(limit).order_by(Envelope.created_at.desc())
        result = await db.execute(query)
        envelopes = result.scalars().all()

        return EnvelopeListResponse(
            envelopes=[EnvelopeResponse.model_validate(e) for e in envelopes],
            total=total,
        )

    async def get_signing_url(
        self, db: AsyncSession, envelope_pk: UUID, signer_email: str | None = None
    ) -> EnvelopeSigningSessionResponse:
        """Generate an embedded signing URL for a recipient.

        If ``signer_email`` is provided, the matching recipient is used.
        Otherwise the first recipient is used.
        """
        self._require_configured()

        envelope = await self.get_envelope(db, envelope_pk)
        if envelope is None:
            raise ValueError("Envelope not found")

        recipients: list[dict[str, object]] = envelope.recipients or []  # type: ignore[assignment]
        if not recipients:
            raise ValueError("Envelope has no recipients")

        # Find the right recipient
        target = recipients[0]
        target_idx = 1
        if signer_email:
            for idx, r in enumerate(recipients, start=1):
                if str(r.get("email", "")).lower() == signer_email.lower():
                    target = r
                    target_idx = idx
                    break

        client, headers = await self._authed_client()
        payload = {
            "authenticationMethod": "None",
            "clientUserId": str(target_idx),
            "recipientId": str(target_idx),
            "returnUrl": f"{settings.FRONTEND_URL}/signing/complete",
            "userName": target.get("name", ""),
            "email": target.get("email", ""),
        }

        async with client:
            resp = await client.post(
                self._account_url(
                    f"/envelopes/{envelope.envelope_id}/views/recipient"
                ),
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        is_sandbox = "demo" in self.base_url or "-d" in self.oauth_base_url
        return EnvelopeSigningSessionResponse(
            signing_url=data["url"],
            integration_key=self.integration_key,
            sandbox=is_sandbox,
        )

    # ------------------------------------------------------------------
    # Status updates
    # ------------------------------------------------------------------

    async def handle_webhook_status_update(
        self,
        db: AsyncSession,
        docusign_envelope_id: str,
        new_status: str,
        recipients: list[dict[str, object]] | None = None,
    ) -> Envelope | None:
        """Process a webhook callback from DocuSign updating envelope status."""
        result = await db.execute(
            select(Envelope).where(Envelope.envelope_id == docusign_envelope_id)
        )
        envelope = result.scalar_one_or_none()
        if envelope is None:
            logger.warning(
                "Webhook received for unknown envelope: %s", docusign_envelope_id
            )
            return None

        envelope.status = new_status  # type: ignore[assignment]
        if recipients is not None:
            envelope.recipients = recipients  # type: ignore[assignment]

        if new_status == "completed" and envelope.completed_at is None:
            envelope.completed_at = datetime.now(UTC)

        await db.commit()
        await db.refresh(envelope)
        return envelope

    async def refresh_envelope_status(
        self, db: AsyncSession, envelope_pk: UUID
    ) -> Envelope | None:
        """Poll DocuSign for the current status of an envelope and update locally."""
        if not self.is_configured():
            return None

        envelope = await self.get_envelope(db, envelope_pk)
        if envelope is None:
            return None

        # Skip terminal states
        if envelope.status in ("completed", "declined", "voided"):
            return envelope

        try:
            client, headers = await self._authed_client()
            async with client:
                resp = await client.get(
                    self._account_url(f"/envelopes/{envelope.envelope_id}"),
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()

            new_status = data.get("status", envelope.status)
            if new_status != envelope.status:
                envelope.status = new_status
                if new_status == "completed" and envelope.completed_at is None:
                    envelope.completed_at = datetime.now(UTC)
                if new_status == "voided":
                    envelope.voided_reason = data.get("voidedReason")
                await db.commit()
                await db.refresh(envelope)
                logger.info(
                    "Envelope %s status updated to %s",
                    envelope.envelope_id,
                    new_status,
                )
        except Exception:
            logger.exception(
                "Failed to refresh status for envelope %s", envelope.envelope_id
            )

        return envelope

    async def sync_pending_envelopes(self, db: AsyncSession) -> int:
        """Poll DocuSign for status of all non-terminal envelopes.

        Returns the number of envelopes that were updated.
        """
        if not self.is_configured():
            return 0

        result = await db.execute(
            select(Envelope).where(
                Envelope.status.notin_(["completed", "declined", "voided"])
            )
        )
        pending = result.scalars().all()
        updated = 0

        for envelope in pending:
            old_status = envelope.status
            try:
                client, headers = await self._authed_client()
                async with client:
                    resp = await client.get(
                        self._account_url(f"/envelopes/{envelope.envelope_id}"),
                        headers=headers,
                    )
                    resp.raise_for_status()
                    data = resp.json()

                new_status = data.get("status", envelope.status)
                if new_status != old_status:
                    envelope.status = new_status
                    if new_status == "completed" and envelope.completed_at is None:
                        envelope.completed_at = datetime.now(UTC)
                    if new_status == "voided":
                        envelope.voided_reason = data.get("voidedReason")
                    updated += 1
            except Exception:
                logger.exception(
                    "Failed to sync envelope %s", envelope.envelope_id
                )

        if updated:
            await db.commit()
            logger.info("Synced %d envelope(s) with updated statuses", updated)

        return updated

    # ------------------------------------------------------------------
    # Webhook HMAC verification
    # ------------------------------------------------------------------

    def verify_webhook_hmac(self, payload: bytes, signature: str) -> bool:
        """Verify DocuSign Connect HMAC-SHA256 signature."""
        if not self.webhook_secret:
            # No HMAC configured — accept all (development mode)
            logger.warning("DOCUSIGN_WEBHOOK_SECRET not set; skipping HMAC verification")
            return True

        expected = hmac.new(
            self.webhook_secret.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)


docusign_service = DocuSignService()
