# Report Sharing with Shareable Links — Implementation Plan

## Overview

Add shareable link functionality to reports. Authenticated users can generate a token-based URL for any report. That URL is publicly accessible (no auth), shows a watermarked read-only view, supports optional expiration and optional password, tracks access counts, and can be revoked.

## Architecture decisions

- Share tokens are 32-byte URL-safe random strings (secrets.token_urlsafe(32)).
- Passwords are stored as bcrypt hashes.
- Report type is stored as a discriminator string — same values already used in `report_schedules` (`portfolio`, `program_status`, `completion`, `annual_review`, `rm_portfolio`, `escalation_log`, `compliance`).
- `entity_id` (string) stores the relevant UUID parameter (program_id or year) when needed.
- The public endpoint lives at `/api/v1/public/reports/{token}` — no auth, no CORS restriction beyond existing CORS settings.
- Download is disabled on the public view (controlled by a flag on the share).

---

## Files to create / modify

### 1. `backend/app/models/shared_report.py` (new)
SQLAlchemy model `SharedReport`:
- `id` UUID PK
- `report_type` String(50) — same enum as report_schedules
- `entity_id` String(100) nullable — program_id / year
- `share_token` String(64) unique indexed
- `created_by` FK → users.id CASCADE
- `expires_at` DateTime(tz) nullable
- `password_hash` String(255) nullable
- `access_count` Integer default 0
- `is_active` Boolean default True
- `allow_download` Boolean default False
- Timestamps via `TimestampMixin`
- Relationship `creator → User`

### 2. `backend/app/schemas/shared_report.py` (new)
Pydantic schemas:
- `SharedReportCreate` — report_type, entity_id?, expires_in (enum: "1d"|"1w"|"1m"|"never"), password?, allow_download?
- `SharedReportResponse` — all fields except password_hash; includes share_url computed from request
- `SharedReportPublicData` — report data returned for public view (typed as `dict[str, Any]`)
- `PublicReportAccessRequest` — password? field for POST body

### 3. `backend/app/api/v1/shared_reports.py` (new, authenticated CRUD)
Router prefix `/reports/shares`:
- `POST /` → create share → returns SharedReportResponse with share_url
- `GET /` → list shares created_by current user
- `DELETE /{share_id}` → revoke (set is_active=False or hard delete)
- No require_* role – any authenticated user (require_internal covers all internal roles; but we allow any logged-in user, same pattern as report schedules)

### 4. `backend/app/api/v1/public_reports.py` (new, unauthenticated)
Router prefix `/public/reports`:
- `GET /{token}` → metadata endpoint; verifies token valid/not-expired/active; returns share metadata + creator name
- `POST /{token}/access` → body may contain password; if correct returns report data + increments access_count

Both endpoints use `DB` dep but NOT `CurrentUser`.

### 5. `backend/alembic/versions/add_shared_reports.py` (new migration)
- Creates `shared_reports` table
- `down_revision = "add_report_favorites"` (current head)
- Revision ID: `"add_shared_reports"`

### 6. `backend/app/models/__init__.py` (modify)
Add `from app.models.shared_report import SharedReport  # noqa: F401`

### 7. `backend/app/api/v1/router.py` (modify)
Register:
```python
from app.api.v1.shared_reports import router as shared_reports_router
from app.api.v1.public_reports import router as public_reports_router
...
router.include_router(shared_reports_router, prefix="/reports/shares", tags=["shared-reports"])
router.include_router(public_reports_router, prefix="/public/reports", tags=["public-reports"])
```

### 8. `frontend/src/lib/api/shared-reports.ts` (new)
Types + API functions:
- `SharedReport` interface
- `createSharedReport(data)` → POST `/api/v1/reports/shares`
- `listSharedReports()` → GET
- `revokeSharedReport(id)` → DELETE
- `getPublicReportMeta(token)` → GET `/api/v1/public/reports/{token}` (no auth header needed — use axios without interceptors or just api client which will fail gracefully)
- `accessPublicReport(token, password?)` → POST `/api/v1/public/reports/{token}/access`

### 9. `frontend/src/components/reports/share-report-dialog.tsx` (new)
Dialog component:
- Props: `open, onClose, reportType, entityId?`
- Step 1 form: expiration select (1 day / 1 week / 1 month / Never), optional password field, allow_download toggle
- On submit: calls createSharedReport, shows generated URL with copy button
- Shows "Link created! Share this URL:" + Input (readonly) + Copy button

### 10. `frontend/src/app/(dashboard)/reports/shared/page.tsx` (new)
Management page for internal users:
- Table of all shares created by current user
- Columns: Report Type, Entity, Created, Expires, Access Count, Status, Actions
- Revoke button per row
- Uses `useQuery` + `useMutation` pattern

### 11. `frontend/src/app/shared/[token]/page.tsx` (new, PUBLIC route — outside dashboard layout)
Public shared report view:
- Route outside `(dashboard)` layout so no auth wrapper
- Fetches metadata, shows watermark "Shared by [creator name] via AMG Portal"
- If password-protected: shows password form first
- Renders report data read-only (simplified table/card layout)
- "Download disabled" notice if allow_download=false
- Falls back gracefully on expired/revoked/not-found tokens (error state)

### 12. `frontend/src/app/(dashboard)/reports/page.tsx` (modify)
Add Share button to each report's action toolbar, wired to `<ShareReportDialog>`.

---

## Report type support matrix

| report_type    | entity_id needed | Data fetcher in public endpoint |
|----------------|------------------|---------------------------------|
| rm_portfolio   | no               | report_service.get_rm_portfolio |
| escalation_log | no               | report_service.get_escalation_log |
| compliance     | no               | report_service.get_compliance_audit |
| annual_review  | year (str)       | report_service.get_annual_review |
| portfolio      | client_id (str)  | report_service.get_portfolio_overview |
| program_status | program_id (str) | report_service.get_program_status_report |
| completion     | program_id (str) | report_service.get_completion_report |

The public endpoint reuses `report_service` methods. No auth check needed (sharing already validates token).

---

## Security considerations
- Token is 32 random bytes → 256 bits entropy, URL-safe base64 encoded → ~43 chars
- bcrypt password hashing (use `passlib` which is already likely a dependency, or `hashlib`/`crypt`)
- Rate limiting is NOT added (no current rate limiting infra visible)
- Expired/inactive shares return 404 (not 403) to prevent probing
- Password verification uses constant-time comparison

---

## Implementation order
1. Model (`shared_report.py`)
2. Schema (`shared_report.py`)
3. Migration
4. Update `models/__init__.py`
5. Authenticated CRUD API (`shared_reports.py`)
6. Public API (`public_reports.py`)
7. Update `router.py`
8. Frontend API client (`shared-reports.ts`)
9. Share dialog component
10. Shared reports management page
11. Public route page
12. Add Share button to reports page
13. Run linters and type checkers
