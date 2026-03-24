# Report Schedule Execution Engine — Implementation Plan

## Current State Analysis

The codebase **already has most of the infrastructure**:

1. **`_process_report_schedules_job()`** (scheduler_service.py:483-574) — Already exists! It queries due schedules, calls `_get_report_data()` and `_generate_report_attachment()`, emails recipients, and updates `last_run`/`next_run`. It runs daily at 6 AM (line 1277).
2. **`last_run` column** — Already exists in model (line 36) and migration.
3. **Helper functions** — `_get_report_data()` (line 1056), `_generate_report_attachment()` (line 1084), `_calculate_next_run()` (line 1121) all exist.

### What's Missing (Delta from Requirements)

| Requirement | Status |
|---|---|
| Run every 15 min instead of daily at 6AM | **Missing** — currently cron at 6:00 |
| Store generated report in MinIO as Document | **Missing** — only emails, no storage |
| Create in-portal notifications for recipients | **Missing** — only sends email |
| Add `last_generated_document_id` to model | **Missing** |
| Extract CSV generation into reusable service | **Missing** — CSV logic inline in routes, scheduler uses flat key/value CSV |
| Manual trigger endpoint (`POST /schedules/{id}/execute`) | **Missing** |
| Frontend: "Run Now" button, status indicator, download link | **Missing** |
| Frontend hook: `useExecuteSchedule` | **Missing** |
| Proper CSV generation in scheduler (reuse route logic) | **Missing** — scheduler CSV is flat key/value, not proper |

---

## Implementation Steps

### Step 1: Add `last_generated_document_id` to ReportSchedule model + migration

**File: `backend/app/models/report_schedule.py`**
- Add column: `last_generated_document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)`
- Add relationship: `last_generated_document = relationship("Document", foreign_keys=[last_generated_document_id])`

**File: `backend/alembic/versions/add_last_generated_document_id.py`** (new)
- Add `last_generated_document_id` column (UUID, FK to documents.id, nullable)

**File: `backend/app/schemas/report_schedule.py`**
- Add `last_generated_document_id: UUID | None = None` to `ReportScheduleResponse`

### Step 2: Create `report_generator_service.py` with reusable CSV generators

**File: `backend/app/services/report_generator_service.py`** (new)
- Extract CSV generation from `reports.py` lines 91-156 (portfolio), 223-283 (program_status), 349-408 (completion), 449-522 (annual_review)
- Functions:
  - `generate_portfolio_csv(report_data: dict) -> bytes`
  - `generate_program_status_csv(report_data: dict) -> bytes`
  - `generate_completion_csv(report_data: dict) -> bytes`
  - `generate_annual_review_csv(report_data: dict) -> bytes`
- Each returns UTF-8 encoded bytes

### Step 3: Refactor API CSV export endpoints to use the new service

**File: `backend/app/api/v1/reports.py`**
- In `export_portfolio_report_csv` (line 78): replace inline CSV logic with `from app.services.report_generator_service import generate_portfolio_csv` and `output_bytes = generate_portfolio_csv(report)`
- Same for `export_program_status_report_csv` (line 196), `export_completion_report_csv` (line 322), `export_annual_review_csv` (line 435)

### Step 4: Enhance `_process_report_schedules_job` and `_generate_report_attachment`

**File: `backend/app/services/scheduler_service.py`**

#### 4a. Update `_generate_report_attachment()` (line 1084)
- Replace the flat CSV fallback with proper CSV generators from `report_generator_service`
- Map `report_type` to the correct generator function

#### 4b. Enhance `_process_report_schedules_job()` (line 483)
After generating attachment bytes, add:
1. **Store in MinIO**: Use `storage_service.client.put_object()` directly (like pdf_service.py:74 does) with key `report_schedules/{schedule.id}/{filename}`
2. **Create Document record**: Insert a `Document` row with entity_type="report_schedule", entity_id=schedule.id
3. **Update `last_generated_document_id`** on the schedule
4. **Create in-portal notifications**: For each recipient email, look up user by email, call `notification_service.create_notification()` with action_url pointing to download endpoint
5. **Email with digest check**: Keep existing email logic but only send if user has immediate delivery preference (check NotificationPreference)

#### 4c. Change job registration (line 1276-1284)
- Change from `"cron", hour=6, minute=0` to `"interval", minutes=15`
- Update job ID to `"report_schedule_executor"`

### Step 5: Add manual trigger endpoint

**File: `backend/app/api/v1/reports.py`**
- Add `POST /schedules/{schedule_id}/execute` endpoint after line 855
- Accept `schedule_id: uuid.UUID`, `db: DB`, `current_user: CurrentUser`
- Dependency: `require_internal`
- Logic: Extract a shared `execute_single_schedule(db, schedule)` function that both the scheduler job and endpoint use
- Returns the updated `ReportScheduleResponse`

### Step 6: Frontend API client — add execute function

**File: `frontend/src/lib/api/schedules.ts`**
- Add `executeReportSchedule(id: string): Promise<ReportSchedule>` — POST to `/api/v1/reports/schedules/${id}/execute`
- Add `last_generated_document_id: string | null` to `ReportSchedule` interface

### Step 7: Frontend hook — add `useExecuteSchedule`

**File: `frontend/src/hooks/use-schedules.ts`**
- Add `useExecuteSchedule()` mutation hook calling `executeReportSchedule`
- On success: toast + invalidate `["report-schedules"]`

### Step 8: Enhance frontend schedules page

**File: `frontend/src/app/(dashboard)/reports/schedules/page.tsx`**
- Add "Run Now" button in each row's Actions cell
- Add status indicator: show a green/red dot based on `last_run` existence
- Add "Download" link when `last_generated_document_id` is present (link to `/api/v1/documents/{id}/download`)
- Wire up `useExecuteSchedule` hook

---

## New Files
1. `backend/app/services/report_generator_service.py`
2. `backend/alembic/versions/add_last_generated_document_id.py`

## Modified Files
1. `backend/app/models/report_schedule.py` — add column + relationship
2. `backend/app/schemas/report_schedule.py` — add field to response
3. `backend/app/services/scheduler_service.py` — enhance job, change interval, add shared execute function
4. `backend/app/api/v1/reports.py` — refactor CSV exports, add execute endpoint
5. `frontend/src/lib/api/schedules.ts` — add execute function, update type
6. `frontend/src/hooks/use-schedules.ts` — add useExecuteSchedule
7. `frontend/src/app/(dashboard)/reports/schedules/page.tsx` — add Run Now, status, download

## Risks & Mitigations

1. **Storage service expects `UploadFile` object**: `upload_file()` reads from UploadFile. For raw bytes, use `client.put_object()` directly like `pdf_service.py:74` does.
2. **Recipient lookup**: Recipients are emails (strings), not user IDs. Need to look up users by email for in-portal notifications. External recipients (no user account) — skip notification.
3. **Circular imports**: scheduler_service already uses local imports pattern — follow same for new imports.

## Verification
```bash
cd backend && ruff check . && mypy .
cd frontend && npm run lint && npm run typecheck
```
