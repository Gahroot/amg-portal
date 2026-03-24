# AMG Portal — Comprehensive Unwired Audit

Audit date: 23 March 2026. Everything listed below was confirmed by reading source files — nothing is speculative.

---

## 🔴 CRITICAL (App-Breaking)

### 1. `backend/app/api/v1/user_preferences.py` — Non-existent import crashes the API on startup
**File:** `backend/app/api/v1/user_preferences.py`, line 9  
**Problem:** `from app.core.dependencies import get_current_active_user, get_db` — `app.core.dependencies` **does not exist** anywhere in the codebase. `get_current_active_user` is also undefined. Since `router.py` imports this file at startup, this is an `ImportError` that crashes the entire FastAPI app on boot.  
**Fix:** Replace with the correct deps:
```python
from app.api.deps import DB, CurrentUser
```
And update all `Depends(get_current_active_user)` / `Depends(get_db)` references to use the `CurrentUser` and `DB` annotated types already used in every other route file.

---

### 2. Frontend URL route conflict: `/settings` declared twice
**Files:**
- `frontend/src/app/(dashboard)/settings/page.tsx` → resolves to `/settings`
- `frontend/src/app/(portal)/settings/page.tsx` → also resolves to `/settings`

**Problem:** Next.js App Router route groups don't add a URL segment, so both files map to the exact same URL. This is an illegal duplicate-page conflict and will throw a Next.js build error (or silently break one of them). The `(portal)/settings/page.tsx` appears to be an older/alternate settings page (uses `useClientPreferences` for portal-specific settings), while `(portal)/portal/settings/page.tsx` is the intended portal settings page at `/portal/settings`.  
**Fix:** Delete or relocate `(portal)/settings/page.tsx`. If the content is needed, merge it into `(portal)/portal/settings/page.tsx`.

---

## 🟠 HIGH (Features Completely Inaccessible)

### 3. `public_reports.py` router never registered
**File:** `backend/app/api/v1/public_reports.py`  
**Problem:** This file has a complete, working `router` with two endpoints:
- `GET /{token}` — fetch shared report metadata
- `POST /{token}/access` — access shared report with optional password

It is **never imported or included in `router.py`**. The entire shared-reports-by-link feature (used by `SharedReport` model, `reports.py`, `shared_reports.py` API, and the frontend `shared-reports.ts` API client) is broken at the access side — no one can open a shared report URL.  
**Fix:** Add to `router.py`:
```python
from app.api.v1.public_reports import router as public_reports_router
# ...
router.include_router(public_reports_router, prefix="/shared", tags=["shared-reports"])
```

---

### 4. `DataExportRequest` model is a ghost
**File:** `backend/app/models/data_export_request.py`  
**Problem:** `DataExportRequest` (a GDPR/compliance self-service export model) is:
- **Not in** `backend/app/models/__init__.py` (Alembic won't see it)
- **No migration** — the `data_export_requests` table doesn't exist in the DB
- **No service** that processes it
- **No API route** to create or retrieve exports

The model is completely orphaned and the entire GDPR data export feature is absent.  
**Fix:** Either wire it up (add to `__init__.py`, write a migration, service, and route), or delete the model file if not planned for Phase 1.

---

### 5. `ClientFeedback` model is a ghost
**File:** `backend/app/models/client_feedback.py`  
**Problem:** `ClientFeedback` (ad-hoc satisfaction signals from clients) is:
- **Not in** `backend/app/models/__init__.py`
- **No migration** — the `client_feedback` table doesn't exist in the DB
- **No service, no API route**

**Fix:** Same as above — either wire up or delete.

---

## 🟡 MEDIUM (Features Built But Not Wired In)

### 6. `recurring_task_service.py` never called
**File:** `backend/app/services/recurring_task_service.py`  
**Problem:** Fully implemented RRULE-based recurring task processing engine (`compute_next_due`, `initialize_next_due`, `process_due_templates`). However:
- Not imported by any API route
- Not imported by `scheduler_service.py` (confirmed — `recurring_task` is not in its imports)
- Not called from anywhere

The `RecurringTaskTemplate` model and its migration (`add_recurring_tasks.py`) exist, but the feature never runs.  
**Fix:** Import and schedule `process_due_templates` in `scheduler_service.py` (e.g., daily at midnight).

---

### 7. `communication_log_service.py` never used
**File:** `backend/app/services/communication_log_service.py`  
**Problem:** `CommunicationLogService` (a thin CRUD wrapper around `CommunicationLog`) is defined but never imported anywhere. The `communication_logs.py` API route queries the model directly with raw SQLAlchemy instead.  
**Fix:** Either import and use the service in `communication_logs.py`, or delete the service file.

---

### 8. No API to manage `PartnerThreshold` records
**Model:** `backend/app/models/partner_threshold.py`  
**Problem:** `PartnerThreshold` is read by `partner_alert_service.py` (which the scheduler calls every hour), but there is no endpoint to CREATE, READ, UPDATE, or DELETE thresholds. Administrators have no way to configure them via the UI or API. Default thresholds are hardcoded in the alert service.  
**Fix:** Add CRUD endpoints (at minimum GET global + GET/PATCH per-partner) to `partners.py` or a new `partner_thresholds.py` route and register in `router.py`.

---

### 9. `TravelLogisticsTab` component never rendered
**File:** `frontend/src/components/travel/travel-logistics-tab.tsx`  
**Problem:** `TravelLogisticsTab` is a fully built component with travel booking CRUD (using `lib/api/travel.ts`) designed to live in the program detail page as a tab. It is **never imported in any page** — not in `programs/[id]/page.tsx` or anywhere else. The travel bookings feature (model + migration + API route + service all exist) is invisible to users.  
**Fix:** Import `TravelLogisticsTab` and add it as a tab in `frontend/src/app/(dashboard)/programs/[id]/page.tsx`.

---

### 10. `CapacityHeatmap` component never rendered
**File:** `frontend/src/components/partners/capacity-heatmap.tsx`  
**Problem:** `CapacityHeatmap` is a fully built component that calls `GET /partners/{id}/availability/heatmap` (which exists in the backend). It is **never imported in any page or parent component**. The partner availability heatmap view is invisible.  
**Fix:** Add to the partner detail page `frontend/src/app/(dashboard)/partners/[id]/page.tsx` (e.g., in a new "Availability" tab).

---

### 11. `IntelligenceNotesEditor` component never rendered
**File:** `frontend/src/components/intelligence/intelligence-notes-editor.tsx`  
**Problem:** `IntelligenceNotesEditor` is exported but **never imported anywhere** in the app. There is a related `IntelligenceFileManager` component (which IS used in the client detail page), but the notes editor is disconnected.  
**Fix:** Import and render inside `IntelligenceFileManager` or the client detail page where contextually appropriate.

---

## 🔵 NAVIGATION GAPS (Pages Exist, No Way to Reach Them)

These pages are fully implemented and functional but have **no nav link** — users can only reach them by typing the URL directly.

| Route | File | Missing From |
|-------|------|-------------|
| `/import` | `(dashboard)/import/page.tsx` | `dashboard-nav.ts` |
| `/documents/expiring` | `(dashboard)/documents/expiring/page.tsx` | `dashboard-nav.ts` |
| `/documents/vault` | `(dashboard)/documents/vault/page.tsx` | `dashboard-nav.ts` |
| `/surveys/pulse` | `(dashboard)/surveys/pulse/page.tsx` | `dashboard-nav.ts` |
| `/settings/integrations` | `(dashboard)/settings/integrations/page.tsx` | `dashboard-nav.ts` (only reachable via a button on `/settings`) |
| `/partner/capability-refresh` | `(partner)/partner/capability-refresh/page.tsx` | `partner-nav.ts` |

**Suggested fixes for dashboard nav:**
- Add `Documents` group with sub-items for `/documents/expiring` and `/documents/vault`
- Add `Import` item under Operations or a Tools group
- Add `Pulse Surveys` under Insights (alongside NPS Surveys)
- Add `Integrations` under Settings
- Add `Capability Refresh` to `partnerNavConfig` under partner navigation

---

## ⚪ LATENT / LOW SEVERITY

### 12. `frontend/src/lib/api/index.ts` — broken barrel export
**Problem:** `export { apiClient } from "./client"` — `client.ts` doesn't exist in `lib/api/`. Currently harmless because no code imports `@/lib/api/index` (everyone imports `@/lib/api` which resolves to `lib/api.ts`). But it makes the barrel file misleading and would break if anyone adds an `index`-based import.  
**Fix:** Remove the `export { apiClient }` line, or create a proper `lib/api/client.ts` that re-exports the axios instance.

### 13. `settings/integrations/page.tsx` uses raw fetch instead of auth-aware axios client
**Problem:** `(dashboard)/settings/integrations/page.tsx` calls `/api/v1/public/webhooks` using raw `fetch()` with `localStorage.getItem("api_key")` as the `X-API-Key` header — completely bypassing the JWT-authenticated axios `api` client that every other page uses. No token refresh, no consistent error handling.  
**Fix:** Refactor to use `api` from `@/lib/api` with proper Bearer token auth (or acknowledge it's intentionally using API key auth and document why).

### 14. Dead example/demo component
**File:** `frontend/src/components/examples/collapsible-section-demo.tsx`  
**Problem:** Development demo component, never imported anywhere. Pure dead code.  
**Fix:** Delete.

---

## 📱 MOBILE APP — Stub Screens (not connected to real data)

The mobile app (`mobile/`) has several screens that render placeholder text only:

| Screen | File | Status |
|--------|------|--------|
| Client Programs | `mobile/app/(client)/index.tsx` | Stub — shows placeholder text |
| Client Reports | `mobile/app/(client)/reports.tsx` | Stub |
| Partner Deliverables | `mobile/app/(partner)/deliverables.tsx` | Stub |
| Partner Home | `mobile/app/(partner)/index.tsx` | Stub |

The mobile app's `lib/api/` only covers ~13 endpoints (programs, auth, clients, partners, etc.) out of the full API surface. Pages like Decisions, Programs detail, and Messages are partially implemented; the rest are stubs. This is expected for an in-progress mobile build but noted for completeness.

---

## Summary Table

| # | Severity | Area | What's Missing |
|---|----------|------|---------------|
| 1 | 🔴 Critical | Backend | `user_preferences.py` has non-existent import → startup crash |
| 2 | 🔴 Critical | Frontend | `/settings` route conflict between `(portal)` and `(dashboard)` groups |
| 3 | 🟠 High | Backend | `public_reports.py` router never registered → shared reports broken |
| 4 | 🟠 High | Backend | `DataExportRequest` model orphaned — no migration, service, or route |
| 5 | 🟠 High | Backend | `ClientFeedback` model orphaned — no migration, service, or route |
| 6 | 🟡 Medium | Backend | `recurring_task_service.py` never called — feature never runs |
| 7 | 🟡 Medium | Backend | `communication_log_service.py` defined but unused |
| 8 | 🟡 Medium | Backend | `PartnerThreshold` has no management API |
| 9 | 🟡 Medium | Frontend | `TravelLogisticsTab` built but never rendered in program detail |
| 10 | 🟡 Medium | Frontend | `CapacityHeatmap` built but never rendered in partner detail |
| 11 | 🟡 Medium | Frontend | `IntelligenceNotesEditor` exported but never imported anywhere |
| 12 | 🔵 Nav | Frontend | 6 pages have no nav link (import, documents/expiring, vault, surveys/pulse, integrations, capability-refresh) |
| 13 | ⚪ Low | Frontend | `lib/api/index.ts` exports from non-existent `./client` |
| 14 | ⚪ Low | Frontend | `settings/integrations` uses raw fetch instead of auth-aware axios |
| 15 | ⚪ Low | Frontend | `collapsible-section-demo.tsx` is dead example code |
| 16 | ℹ️ Info | Mobile | Most partner/client screens are stubs |
