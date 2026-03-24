# File Request Feature — Implementation Plan

## Overview
Clients need to request specific documents FROM their RM (inverse of existing DocumentRequest which is RM→Client).

New entity: `FileRequest` (client→RM). Status flow: `requested` → `in_progress` → `delivered` | `cancelled`.

---

## Backend

### 1. `backend/app/models/enums.py` — Add enums (end of file)
```python
class FileRequestStatus(StrEnum):
    requested = "requested"
    in_progress = "in_progress"
    delivered = "delivered"
    cancelled = "cancelled"

class FileRequestDocumentType(StrEnum):
    account_statement = "account_statement"
    investment_report = "investment_report"
    tax_document = "tax_document"
    compliance_certificate = "compliance_certificate"
    portfolio_report = "portfolio_report"
    contract = "contract"
    signed_agreement = "signed_agreement"
    legal_opinion = "legal_opinion"
    program_update = "program_update"
    other = "other"
```

### 2. `backend/app/models/file_request.py` (new)
```python
class FileRequest(Base, TimestampMixin):
    __tablename__ = "file_requests"
    id: UUID pk
    client_id: UUID → client_profiles.id (CASCADE)
    requested_by: UUID → users.id (SET NULL)   # the client user
    document_type: String(50) not null
    description: Text nullable
    urgency: String(20) not null default "normal"   # low/normal/high
    status: String(20) not null default "requested" index=True
    requested_at: DateTime tz not null
    fulfilled_at: DateTime tz nullable
    fulfilled_document_id: UUID → documents.id nullable
    rm_notes: Text nullable  # RM can add notes when fulfilling
    # relationships: requester (User), fulfilled_document (Document)
```

### 3. `backend/app/schemas/file_request.py` (new)
- `FileRequestCreate`: `document_type`, `description`, `urgency`
- `FileRequestStatusUpdate`: `status`, `rm_notes`
- `FulfillFileRequestBody`: `document_id`
- `FileRequestResponse`: full response model
- `FileRequestListResponse`: `requests: list[...]`, `total: int`

### 4. `backend/app/services/file_request_service.py` (new)
- `create_file_request(db, data, client_profile_id, requested_by_user_id)` → creates record, notifies assigned RM via notification_service
- `list_requests_for_client(db, user_id, status?)` → scoped to client's profile
- `list_requests_for_rm(db, rm_user_id, status?, skip, limit)` → all client_profiles.assigned_rm_id == rm_user_id
- `get_file_request(db, request_id)` → single record
- `update_status(db, request_id, status, rm_notes?)` → mark in_progress etc.
- `fulfill_file_request(db, request_id, document_id)` → sets delivered, fulfilled_at, notifies client
- Notification helpers: `_notify_rm_new_request`, `_notify_client_delivered`

### 5. `backend/app/api/v1/file_requests.py` (new)
Router prefix handled in router.py.

**Client portal endpoints** (require_client):
- `POST /portal/file-requests` — create request
- `GET /portal/file-requests` — list client's requests (query: status?)
- `POST /portal/file-requests/{id}/cancel` — cancel pending request

**RM/internal endpoints** (require_internal):
- `GET /file-requests` — list requests for RM (query: client_id?, status?, skip, limit)
- `GET /file-requests/{id}` — get single
- `PATCH /file-requests/{id}/status` — update status (in_progress etc.)
- `POST /file-requests/{id}/fulfill` — fulfill with `document_id` body

### 6. `backend/app/models/__init__.py`
Add: `from app.models.file_request import FileRequest  # noqa: F401`

### 7. `backend/app/api/v1/router.py`
Add import and:
```python
router.include_router(file_requests_portal_router, prefix="/portal", tags=["portal"])
router.include_router(file_requests_router, prefix="/file-requests", tags=["file-requests"])
```
(Or split into two routers in the same file, using separate APIRouter instances)

### 8. `backend/alembic/versions/add_file_requests.py` (new)
- revision: `b2c3d4e5f6a7`
- down_revision: last migration (check alembic head)
- creates `file_requests` table

---

## Frontend

### 9. `frontend/src/types/file-request.ts` (new)
```ts
export type FileRequestStatus = "requested" | "in_progress" | "delivered" | "cancelled";
export type FileRequestDocumentType = "account_statement" | "investment_report" | ... | "other";
export interface FileRequestItem { id, client_id, requested_by, document_type, description, urgency, status, requested_at, fulfilled_at, fulfilled_document_id, rm_notes, created_at, updated_at }
export interface FileRequestListResponse { requests: FileRequestItem[]; total: number; }
export interface FileRequestCreate { document_type: FileRequestDocumentType; description?: string; urgency?: "low" | "normal" | "high"; }
```

### 10. `frontend/src/lib/api/file-requests.ts` (new)
- `createFileRequest(data)` → POST `/api/v1/portal/file-requests`
- `getMyFileRequests(status?)` → GET `/api/v1/portal/file-requests`
- `cancelMyFileRequest(id)` → POST `/api/v1/portal/file-requests/{id}/cancel`
- `listFileRequests(params?)` → GET `/api/v1/file-requests` (internal)
- `getFileRequest(id)` → GET `/api/v1/file-requests/{id}` (internal)
- `updateFileRequestStatus(id, data)` → PATCH `/api/v1/file-requests/{id}/status` (internal)
- `fulfillFileRequest(id, document_id)` → POST `/api/v1/file-requests/{id}/fulfill` (internal)

### 11. `frontend/src/hooks/use-file-requests.ts` (new)
- `useMyFileRequests(status?)` — portal (client)
- `useCreateFileRequest()` — portal (client)
- `useCancelMyFileRequest()` — portal (client)
- `useFileRequests(params?)` — internal (RM)
- `useFulfillFileRequest()` — internal (RM)
- `useUpdateFileRequestStatus()` — internal (RM)

### 12. `frontend/src/components/portal/request-file-dialog.tsx` (new)
Dialog component:
- Select document type (dropdown with labels)
- Description textarea
- Urgency selector (Low / Normal / High)
- Submit button

### 13. `frontend/src/app/(portal)/portal/documents/file-requests/page.tsx` (new)
Client portal page showing their outgoing file requests with status badges.
Includes the "Request Document" button which opens RequestFileDialog.

### 14. `frontend/src/app/(portal)/portal/documents/page.tsx` — UPDATE
Add a "Request a Document" button linking to `/portal/documents/file-requests`.

### 15. `frontend/src/config/portal-nav.ts` — UPDATE
Add sub-item under Documents for "File Requests" → `/portal/documents/file-requests`.

### 16. `frontend/src/app/(dashboard)/documents/file-requests/page.tsx` (new) — RM view
Shows all pending file requests from clients, allows RM to update status and fulfill.

---

## Migration revision chain
Check latest migration with `cd backend && alembic heads`. Use that as down_revision.

---

## File creation order
1. enums.py (add new enums)
2. file_request model
3. file_request schemas
4. file_request service
5. file_request API routes
6. models/__init__.py registration
7. router.py registration  
8. alembic migration
9. frontend types
10. frontend API
11. frontend hooks
12. RequestFileDialog component
13. Portal file-requests page
14. Update portal documents page
15. Update portal-nav config
16. Dashboard RM file-requests page
