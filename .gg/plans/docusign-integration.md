# DocuSign Integration Plan

## Overview
Integrate DocuSign eSignature via the `docusign-esign` Python SDK into the AMG Portal backend.

## Files to Change

### 1. `backend/pyproject.toml`
Add `"docusign-esign>=3.25.0"` to `dependencies` list.

### 2. `backend/app/core/config.py`
Add DocuSign settings to the `Settings` class:
```python
# DocuSign
DOCUSIGN_INTEGRATION_KEY: str = ""        # OAuth client_id / integration key
DOCUSIGN_USER_ID: str = ""                # Impersonated user's GUID
DOCUSIGN_ACCOUNT_ID: str = ""             # DocuSign account ID
DOCUSIGN_PRIVATE_KEY: str = ""            # RSA private key (PEM string, newlines as \n)
DOCUSIGN_BASE_URI: str = "https://demo.docusign.net/restapi"
DOCUSIGN_AUTH_SERVER: str = "account-d.docusign.com"   # demo; prod = account.docusign.com
DOCUSIGN_RETURN_URL: str = "http://localhost:3000/docusign/complete"
```

### 3. `backend/app/models/document.py`
Add two nullable columns after `chain_of_custody`:
```python
envelope_id = Column(String(100), nullable=True)
docusign_status = Column(String(50), nullable=True)
```

### 4. `backend/alembic/versions/add_docusign_envelope_id.py`  *(new)*
Migration to add the two columns to `documents`:
```python
revision: str = "add_docusign_envelope_id"
down_revision: str = "add_communication_audits"   # current leaf
```
`upgrade()`: `op.add_column("documents", sa.Column("envelope_id", sa.String(100), nullable=True))` and same for `docusign_status`.
`downgrade()`: drops both columns.

### 5. `backend/app/schemas/docusign.py`  *(new)*
```python
class CreateEnvelopeRequest(BaseModel):
    document_id: UUID                 # which Document to send
    signer_email: str
    signer_name: str
    return_url: str                   # redirect after signing

class EnvelopeResponse(BaseModel):
    envelope_id: str
    document_id: UUID
    docusign_status: str

class SigningUrlRequest(BaseModel):
    document_id: UUID
    signer_email: str
    signer_name: str
    return_url: str

class SigningUrlResponse(BaseModel):
    signing_url: str
    envelope_id: str
```

### 6. `backend/app/schemas/document.py`
Add optional fields to `DocumentResponse`:
```python
envelope_id: str | None = None
docusign_status: str | None = None
```

### 7. `backend/app/services/docusign_service.py`  *(new)*
```python
"""DocuSign eSignature service — JWT authentication + envelope creation."""
import base64
from uuid import UUID
from docusign_esign import (
    ApiClient,
    EnvelopesApi,
    EnvelopeDefinition,
    Document as DSDocument,
    Signer,
    SignHere,
    Tabs,
    Recipients,
    RecipientViewRequest,
)
from app.core.config import settings
from app.services.storage import storage_service


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


def create_envelope(
    file_bytes: bytes,
    file_name: str,
    file_extension: str,
    document_id_str: str,
    signer_email: str,
    signer_name: str,
) -> str:
    """Create a DocuSign envelope and return the envelope_id."""
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
        client_user_id="1000",  # marks as embedded signing
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
    return result.envelope_id


def get_signing_url(
    envelope_id: str,
    signer_email: str,
    signer_name: str,
    return_url: str,
) -> str:
    """Get an embedded signing URL for the given envelope."""
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
    return result.url
```

### 8. `backend/app/api/v1/docusign.py`  *(new)*
Two endpoints using `require_internal` auth:

**POST `/docusign/envelopes`**
- Body: `CreateEnvelopeRequest`
- Loads `Document` by `document_id` → downloads bytes from MinIO storage
- Calls `docusign_service.create_envelope()`
- Saves `doc.envelope_id` and `doc.docusign_status = "sent"` on the Document
- Returns `EnvelopeResponse`

**GET `/docusign/signing-url`**
- Query params: `document_id`, `signer_email`, `signer_name`, `return_url`
- Loads `Document`, checks it has an `envelope_id`
- Calls `docusign_service.get_signing_url()`
- Returns `SigningUrlResponse`

Error handling:
- 404 if Document not found
- 400 if document has no envelope_id (for signing-url)
- 503 if DocuSign API call fails (catch `ApiException`)

### 9. `backend/app/api/v1/router.py`
Add:
```python
from app.api.v1.docusign import router as docusign_router
router.include_router(docusign_router, prefix="/docusign", tags=["docusign"])
```

## Implementation Order
1. `pyproject.toml` — add dependency
2. `config.py` — add settings
3. `models/document.py` — add columns
4. `alembic/versions/add_docusign_envelope_id.py` — migration
5. `schemas/document.py` — add optional fields to DocumentResponse
6. `schemas/docusign.py` — new schemas
7. `services/docusign_service.py` — new service
8. `api/v1/docusign.py` — new router
9. `api/v1/router.py` — register router

## Notes
- DocuSign SDK is **sync** (not async). Calls must be wrapped with `asyncio.get_event_loop().run_in_executor(None, ...)` or run in a thread pool to avoid blocking the async FastAPI event loop. Use `anyio.to_thread.run_sync()` (available via FastAPI/starlette's `run_in_threadpool`).
- `fastapi.concurrency.run_in_threadpool` is the right import for FastAPI.
- If `DOCUSIGN_INTEGRATION_KEY` is empty, endpoints should return 503 with a clear "DocuSign not configured" message.
- File extension for signing URL is derived from `content_type` (e.g., `application/pdf` → `pdf`).
- `storage_service.get_presigned_url()` returns a URL; to get bytes use `httpx` async GET.

## Risks
- DocuSign SDK is synchronous — use `run_in_threadpool` to avoid blocking.
- Private key must be stored with actual newlines in env (use `\n` escape in `.env` file).
- Multiple alembic heads exist; `add_communication_audits` is confirmed to be a leaf with no dependents.
