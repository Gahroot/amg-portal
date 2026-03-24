# Document Delivery System & Evidence Vault — Implementation Plan

## Overview
Add document packages (delivery bundles, evidence vaults, report bundles), access logging, and client-facing package acknowledgment. Three new backend models, one migration, schemas, API routes, and multiple frontend pages.

## Task Breakdown (10 tasks, dependency-ordered)

---

### Task 1: Backend Models (3 new files)
**Files to create:**
- `backend/app/models/document_package.py`
- `backend/app/models/document_package_item.py`
- `backend/app/models/document_access_log.py`

**File to edit:**
- `backend/app/models/__init__.py` — add imports for all 3 new models

**Details:**
- Follow existing Column-style pattern (matching `document.py`, `document_acknowledgment.py`)
- `DocumentPackage`: id (UUID PK), title (String 255), description (Text nullable), package_type (String 50), client_id (UUID FK clients.id), program_id (UUID FK programs.id nullable), created_by (UUID FK users.id), status (String 30 default "draft"), delivered_at (DateTime nullable), acknowledged_at (DateTime nullable), acknowledged_by (UUID FK users.id nullable), evidence_category (String 50 nullable), created_at, updated_at
- `DocumentPackageItem`: id (UUID PK), package_id (UUID FK document_packages.id CASCADE), document_id (UUID FK documents.id), sort_order (Integer default 0), notes (Text nullable)
- `DocumentAccessLog`: id (UUID PK), document_id (UUID FK documents.id), user_id (UUID FK users.id), access_type (String 30), accessed_at (DateTime), ip_address (String 45 nullable), user_agent (String 500 nullable)
- Add relationships: DocumentPackage → items, creator; DocumentPackageItem → package, document
- Register in `__init__.py` after the `Document` import (line 27)

---

### Task 2: Alembic Migration
**File to create:**
- `backend/alembic/versions/add_document_packages.py`

**Details:**
- Revision ID: `add_document_packages`
- Down revision: `add_document_acknowledgments`
- Create 3 tables: `document_packages`, `document_package_items`, `document_access_logs`
- Add indexes: package client_id, program_id, status; item package_id; access_log document_id, user_id
- Follow pattern from `add_document_acknowledgments.py`

---

### Task 3: Backend Schemas
**File to create:**
- `backend/app/schemas/document_package.py`

**Details:**
- `DocumentPackageCreate(BaseModel)`: title (str), description (str | None = None), package_type (str), client_id (UUID), program_id (UUID | None = None), document_ids (list[UUID] = []), evidence_category (str | None = None)
- `DocumentPackageUpdate(BaseModel)`: title (str | None = None), description (str | None = None), status (str | None = None), document_ids (list[UUID] | None = None), evidence_category (str | None = None)
- `DocumentAccessLogResponse(BaseModel)`: id (UUID), access_type (str), accessed_at (datetime), user_name (str | None = None), model_config from_attributes
- `DocumentPackageItemResponse(BaseModel)`: id (UUID), document_id (UUID), sort_order (int), notes (str | None), file_name (str), file_size (int), content_type (str | None), download_url (str | None), view_count (int = 0), last_accessed (datetime | None = None), model_config from_attributes
- `DocumentPackageResponse(BaseModel)`: all model fields + items (list[DocumentPackageItemResponse]) + created_by_name (str | None), model_config from_attributes
- `DocumentPackageListResponse(BaseModel)`: packages (list[DocumentPackageResponse]), total (int)

---

### Task 4: Backend API — Document Packages
**File to create:**
- `backend/app/api/v1/document_packages.py`

**File to edit:**
- `backend/app/api/v1/router.py` — add import and include_router (prefix="/document-packages", tags=["document-packages"])

**Endpoints:**
1. `POST /` — Create package. Requires coordinator_or_above. Creates DocumentPackage + DocumentPackageItem entries for each document_id.
2. `GET /` — List with filters: client_id, program_id, package_type, status, skip, limit. Internal users see scoped by RM. Clients see only delivered packages.
3. `GET /{id}` — Get package with items + access logs per item.
4. `PUT /{id}` — Update package metadata + optionally replace document_ids list.
5. `POST /{id}/deliver` — Set status="delivered", delivered_at=now(UTC). Create Notification for client users. Create SLATracker (entity_type="document_package", sla_hours=48).
6. `POST /{id}/acknowledge` — Client-facing. Set acknowledged_at, acknowledged_by. Update SLATracker. Notify creator.
7. `DELETE /{id}` — Only draft packages. Coordinator+ only.

**Additional endpoints on documents router (edit `documents.py`):**
- `POST /documents/{id}/log-access` — Create DocumentAccessLog entry.
- `GET /documents/{id}/access-log` — Get access history. Internal only.

**Dependencies used:** DB, CurrentUser, RLSContext, require_coordinator_or_above, require_internal, RoleChecker

---

### Task 5: Backend — Auto-log access on document download
**File to edit:**
- `backend/app/api/v1/documents.py` — In `download_document()`, add `request: Request` param and create DocumentAccessLog(access_type="downloaded")
- `backend/app/api/v1/client_portal.py` — In `get_my_document()`, add `request: Request` param and create DocumentAccessLog(access_type="viewed")

---

### Task 6: Frontend Types & API Client
**Files to create:**
- `frontend/src/types/document-package.ts`
- `frontend/src/lib/api/document-packages.ts`

**API functions:** listDocumentPackages, getDocumentPackage, createDocumentPackage, updateDocumentPackage, deleteDocumentPackage, deliverDocumentPackage, acknowledgeDocumentPackage, logDocumentAccess, getDocumentAccessLog

---

### Task 7: Frontend Hooks
**File to create:**
- `frontend/src/hooks/use-document-packages.ts`

**Hooks:** useDocumentPackages(filters), useDocumentPackage(id), useCreatePackage(), useUpdatePackage(), useDeliverPackage(), useAcknowledgePackage(), useDocumentAccessLog(docId)

---

### Task 8: Frontend — Dashboard Pages
**Files to create:**
- `frontend/src/app/(dashboard)/documents/packages/page.tsx` — List with filters, status badges, table
- `frontend/src/app/(dashboard)/documents/packages/new/page.tsx` — Create form
- `frontend/src/app/(dashboard)/documents/packages/[id]/page.tsx` — Detail view with access stats
- `frontend/src/app/(dashboard)/documents/evidence-vault/page.tsx` — Filtered evidence vault view

---

### Task 9: Frontend — Portal Documents Enhancement
**File to edit:**
- `frontend/src/app/(portal)/portal/documents/page.tsx` — Add Document Packages section with Acknowledge button
- `frontend/src/lib/api/client-portal.ts` — Add package listing/acknowledgment functions
- `frontend/src/hooks/use-portal-documents.ts` — Add usePortalDocumentPackages() hook

---

### Task 10: Frontend — Navigation
**File to edit:**
- `frontend/src/config/dashboard-nav.ts` — Add "Document Packages" (href="/documents/packages") and "Evidence Vault" (href="/documents/evidence-vault") to Operations group

---

## Verification
```bash
cd backend && ruff check . && mypy .
cd frontend && npm run lint && npm run typecheck
```

## Risks
- Migration chain: must chain after `add_document_acknowledgments`
- Client resolution: portal endpoints resolve via Client.id not ClientProfile.id
- Request parameter addition: adding `request: Request` to existing endpoints must preserve signatures
- Drag-to-reorder: use simple up/down buttons (avoid new dependency)
