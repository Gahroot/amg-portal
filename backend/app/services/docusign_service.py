"""DocuSign eSignature service — JWT authentication + envelope creation."""

import base64

from docusign_esign import (
    ApiClient,
    EnvelopeDefinition,
    EnvelopesApi,
    Recipients,
    RecipientViewRequest,
    Signer,
    SignHere,
    Tabs,
)
from docusign_esign import (
    Document as DSDocument,
)
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool

from app.core.config import settings


def _check_configured() -> None:
    """Raise 503 if DocuSign is not configured."""
    if not settings.DOCUSIGN_INTEGRATION_KEY:
        raise HTTPException(status_code=503, detail="DocuSign not configured")


def _get_api_client() -> ApiClient:
    """Return an authenticated ApiClient using JWT grant."""
    api_client = ApiClient()
    api_client.set_base_path(settings.DOCUSIGN_BASE_URI)
    api_client.set_oauth_host_name(settings.DOCUSIGN_AUTH_SERVER)

    private_key = settings.DOCUSIGN_PRIVATE_KEY.encode("utf-8").replace(b"\\n", b"\n")

    token_response = api_client.request_jwt_user_token(
        client_id=settings.DOCUSIGN_INTEGRATION_KEY,
        user_id=settings.DOCUSIGN_USER_ID,
        oauth_host_name=settings.DOCUSIGN_AUTH_SERVER,
        private_key_bytes=private_key,
        expires_in=3600,
        scopes=["signature", "impersonation"],
    )
    api_client.set_default_header("Authorization", f"Bearer {token_response.access_token}")
    return api_client


def _sync_create_envelope(
    file_bytes: bytes,
    file_name: str,
    file_extension: str,
    signer_email: str,
    signer_name: str,
) -> str:
    """Synchronous envelope creation — must be called via run_in_threadpool."""
    api_client = _get_api_client()

    doc_b64 = base64.b64encode(file_bytes).decode("ascii")
    ds_document = DSDocument(
        document_base64=doc_b64,
        name=file_name,
        file_extension=file_extension,
        document_id="1",
    )

    signer = Signer(
        email=signer_email,
        name=signer_name,
        recipient_id="1",
        routing_order="1",
        client_user_id="1000",
    )
    sign_here = SignHere(
        anchor_string="/sn1/",
        anchor_units="pixels",
        anchor_y_offset="10",
        anchor_x_offset="20",
    )
    signer.tabs = Tabs(sign_here_tabs=[sign_here])

    env = EnvelopeDefinition(
        email_subject="Please sign this document",
        documents=[ds_document],
        recipients=Recipients(signers=[signer]),
        status="sent",
    )

    envelopes_api = EnvelopesApi(api_client)
    result = envelopes_api.create_envelope(
        account_id=settings.DOCUSIGN_ACCOUNT_ID,
        envelope_definition=env,
    )
    return result.envelope_id  # type: ignore[no-any-return]


def _sync_get_signing_url(
    envelope_id: str,
    signer_email: str,
    signer_name: str,
    return_url: str,
) -> str:
    """Synchronous signing URL retrieval — must be called via run_in_threadpool."""
    api_client = _get_api_client()
    envelopes_api = EnvelopesApi(api_client)

    view_request = RecipientViewRequest(
        authentication_method="none",
        client_user_id="1000",
        recipient_id="1",
        return_url=return_url,
        user_name=signer_name,
        email=signer_email,
    )
    result = envelopes_api.create_recipient_view(
        account_id=settings.DOCUSIGN_ACCOUNT_ID,
        envelope_id=envelope_id,
        recipient_view_request=view_request,
    )
    return result.url  # type: ignore[no-any-return]


async def create_envelope(
    file_bytes: bytes,
    file_name: str,
    file_extension: str,
    signer_email: str,
    signer_name: str,
) -> str:
    """Create a DocuSign envelope and return the envelope_id."""
    _check_configured()
    return await run_in_threadpool(
        _sync_create_envelope,
        file_bytes,
        file_name,
        file_extension,
        signer_email,
        signer_name,
    )


async def get_signing_url(
    envelope_id: str,
    signer_email: str,
    signer_name: str,
    return_url: str,
) -> str:
    """Get an embedded signing URL for the given envelope."""
    _check_configured()
    return await run_in_threadpool(
        _sync_get_signing_url,
        envelope_id,
        signer_email,
        signer_name,
        return_url,
    )
