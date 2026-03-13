"""DocuSign envelope management endpoints.

Includes internal CRUD, partner signing access, and a webhook endpoint
for DocuSign Connect status callbacks.

Route ordering: Static paths (``/partner/me``, ``/webhook``) are defined
**before** the dynamic ``/{envelope_id}`` path to avoid FastAPI matching
``partner`` or ``webhook`` as a UUID (which would fail with 422).
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from starlette.responses import JSONResponse

from app.api.deps import DB, CurrentUser, require_internal, require_partner
from app.schemas.envelope import (
    EnvelopeCreateRequest,
    EnvelopeListResponse,
    EnvelopeResponse,
    EnvelopeSigningSessionResponse,
)
from app.services.docusign_service import (
    DocuSignNotConfiguredError,
    docusign_service,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _handle_not_configured() -> None:
    """Raise 503 if DocuSign is not configured."""
    if not docusign_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="DocuSign integration is not configured",
        )


# ------------------------------------------------------------------
# Static paths first (before /{envelope_id})
# ------------------------------------------------------------------


@router.get("/", response_model=EnvelopeListResponse)
async def list_envelopes(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    status: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> EnvelopeListResponse:
    return await docusign_service.list_envelopes(
        db, status=status, skip=skip, limit=limit
    )


@router.post("/", response_model=EnvelopeResponse, status_code=201)
async def create_envelope(
    request: EnvelopeCreateRequest,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> EnvelopeResponse:
    _handle_not_configured()
    try:
        return await docusign_service.create_envelope(
            db,
            request,
            user_id=current_user.id,
            user_name=current_user.full_name,
            user_email=current_user.email,
        )
    except DocuSignNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


# -- Partner static paths --


@router.get("/partner/me", response_model=EnvelopeListResponse)
async def list_partner_envelopes(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_partner),
    status: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> EnvelopeListResponse:
    """List envelopes where the current partner's email is a recipient."""
    return await docusign_service.list_envelopes_for_email(
        db, current_user.email, status=status, skip=skip, limit=limit
    )


@router.get("/partner/{envelope_id}", response_model=EnvelopeResponse)
async def get_partner_envelope(
    envelope_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_partner),
) -> EnvelopeResponse:
    """Get a single envelope — only if the partner is a recipient."""
    envelope = await docusign_service.get_envelope(db, envelope_id)
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")

    # Ensure this partner is actually a recipient
    recipients: list[dict[str, object]] = envelope.recipients or []  # type: ignore[assignment]
    is_recipient = any(
        str(r.get("email", "")).lower() == current_user.email.lower()
        for r in recipients
    )
    if not is_recipient:
        raise HTTPException(status_code=404, detail="Envelope not found")

    return EnvelopeResponse.model_validate(envelope)


@router.post(
    "/partner/{envelope_id}/signing-session",
    response_model=EnvelopeSigningSessionResponse,
)
async def get_partner_signing_session(
    envelope_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_partner),
) -> EnvelopeSigningSessionResponse:
    """Generate an embedded signing URL for the partner's recipient entry."""
    _handle_not_configured()
    try:
        return await docusign_service.get_signing_url(
            db, envelope_id, signer_email=current_user.email
        )
    except DocuSignNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# -- Webhook --


@router.post("/webhook")
async def docusign_webhook(request: Request, db: DB) -> JSONResponse:
    """Handle DocuSign Connect webhook callbacks.

    DocuSign sends XML by default, but can be configured to send JSON.
    We accept both — for XML we extract minimal fields, for JSON we
    parse the full payload.
    """
    body = await request.body()

    # Verify HMAC if configured
    hmac_signature = request.headers.get("X-DocuSign-Signature-1", "")
    if not docusign_service.verify_webhook_hmac(body, hmac_signature):
        logger.warning("DocuSign webhook HMAC verification failed")
        raise HTTPException(status_code=401, detail="Invalid signature")

    content_type = request.headers.get("content-type", "")

    try:
        if "json" in content_type:
            payload = await request.json()
            envelope_id = payload.get("envelopeId", "")
            status = payload.get("status", "")

            # Extract recipient statuses if available
            recipients = None
            signers = (
                payload.get("recipients", {}).get("signers", [])
                if isinstance(payload.get("recipients"), dict)
                else []
            )
            if signers:
                recipients = [
                    {
                        "name": s.get("name", ""),
                        "email": s.get("email", ""),
                        "status": s.get("status", "pending"),
                        "signed_at": s.get("signedDateTime"),
                        "declined_reason": s.get("declinedReason"),
                    }
                    for s in signers
                ]

            if envelope_id and status:
                await docusign_service.handle_webhook_status_update(
                    db, envelope_id, status, recipients
                )
        else:
            # XML payload — extract envelope ID and status via basic parsing
            import xml.etree.ElementTree as ET

            root = ET.fromstring(body)
            # DocuSign XML uses a namespace
            ns = {"ds": "http://www.docusign.net/API/3.0"}

            envelope_status_el = root.find(".//ds:EnvelopeStatus", ns)
            if envelope_status_el is None:
                # Try without namespace
                envelope_status_el = root.find(".//EnvelopeStatus")

            if envelope_status_el is not None:
                env_id_el = envelope_status_el.find("ds:EnvelopeID", ns)
                if env_id_el is None:
                    env_id_el = envelope_status_el.find("EnvelopeID")
                status_el = envelope_status_el.find("ds:Status", ns)
                if status_el is None:
                    status_el = envelope_status_el.find("Status")

                if (
                    env_id_el is not None
                    and env_id_el.text
                    and status_el is not None
                    and status_el.text
                ):
                    await docusign_service.handle_webhook_status_update(
                        db,
                        env_id_el.text,
                        status_el.text.lower(),
                    )
    except Exception:
        logger.exception("Error processing DocuSign webhook")
        # Return 200 to prevent DocuSign from retrying
        return JSONResponse({"status": "error"}, status_code=200)

    return JSONResponse({"status": "ok"})


# ------------------------------------------------------------------
# Dynamic paths (/{envelope_id} — must be AFTER static paths)
# ------------------------------------------------------------------


@router.get("/{envelope_id}", response_model=EnvelopeResponse)
async def get_envelope(
    envelope_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> EnvelopeResponse:
    envelope = await docusign_service.get_envelope(db, envelope_id)
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    return EnvelopeResponse.model_validate(envelope)


@router.post(
    "/{envelope_id}/signing-session",
    response_model=EnvelopeSigningSessionResponse,
)
async def get_signing_session(
    envelope_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> EnvelopeSigningSessionResponse:
    _handle_not_configured()
    try:
        return await docusign_service.get_signing_url(db, envelope_id)
    except DocuSignNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/{envelope_id}/refresh-status",
    response_model=EnvelopeResponse,
)
async def refresh_envelope_status(
    envelope_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> EnvelopeResponse:
    """Manually trigger a status refresh from DocuSign for one envelope."""
    _handle_not_configured()
    envelope = await docusign_service.refresh_envelope_status(db, envelope_id)
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    return EnvelopeResponse.model_validate(envelope)
