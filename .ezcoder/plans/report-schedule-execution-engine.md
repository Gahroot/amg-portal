# Report Schedule Execution Engine Plan

## Overview
Add automated report schedule execution with MinIO document storage, a manual trigger endpoint, and frontend enhancements.

## Task 1: Add `last_generated_document_id` column to ReportSchedule model

### File: `backend/app/models/report_schedule.py`
- Add import for `relationship` (already imported)
- Add column after `last_run` (line 36):
  ```python
  last_generated_document_id: Mapped[uuid.UUID | None] = mapped_column(
      UUID(as_uuid=True),
      ForeignKey("documents.id", ondelete="SET NULL"),
      nullable=True,
  )
  ```
- Add relationship: `last_generated_document = relationship("Document", foreign_keys=[last_generated_document_id])`

### File: `backend/alembic/versions/add_last_generated_document_id.py` (new)
- New migration that adds `last_generated_document_id` UUID column (nullable) to `report_schedules`
- Add FK constraint to `documents.id` with `SET NULL` on delete
- `down_revision` = `"f5a6b7c8d9e0"` (the add_report_schedule migration)

### File: `backend/app/schemas/report_schedule.py`
- Add `last_generated_document_id: UUID | None = None` to `ReportScheduleResponse`

---

## Task 2: Create `backend/app/services/report_generator_service.py`

New service that:
1. Takes a `ReportSchedule` and an `AsyncSession`
2. Uses `report_service` to fetch report data (reuses `_get_report_data` pattern from scheduler_service.py)
3. Uses `pdf_service` for PDF format or generates CSV (reuses `_generate_report_attachment` pattern)
4. Uploads to MinIO via `storage_service.client.put_object()` (direct, not via UploadFile)
5. Creates a `Document` record in the DB
6. Returns the created `Document`

Key functions:
```python
async def generate_report_for_schedule(db: AsyncSession, schedule: ReportSchedule) -> Document | None:
    """Generate a report file, store in MinIO, create Document record."""
```

Uses existing patterns from `_get_report_data` and `_generate_report_attachment` in scheduler_service.py but properly creates Document records and stores in MinIO.

---

## Task 3: Enhance scheduler job in `backend/app/services/scheduler_service.py`

### Modify `_process_report_schedules_job()` (lines 483-574)
- After generating the attachment bytes, also store in MinIO and create Document record
- Update `schedule.last_generated_document_id` when updating `last_run` and `next_run`
- Import and use `report_generator_service`

Actually, refactor to call `report_generator_service.generate_report_for_schedule()` instead of duplicating logic.

### Add `_execute_report_schedule_job()` (new function)
This is the enhanced version that:
1. Queries due schedules (next_run <= now, is_active=True)  
2. For each: calls `report_generator_service.generate_report_for_schedule()`
3. Updates `last_run`, `next_run`, `last_generated_document_id`
4. Emails the attachment to recipients (existing email pattern)
5. Sends in-portal notifications to the schedule creator

### Register in `start_scheduler()`
Replace the existing `_process_report_schedules_job` registration with `_execute_report_schedule_job`, or update the existing job function.

**Decision**: Simply enhance the existing `_process_report_schedules_job` to also store documents. This avoids breaking the existing scheduler registration.

---

## Task 4: Manual trigger endpoint

### File: `backend/app/api/v1/reports.py`
Add after the delete schedule endpoint (after line 855):

```python
@router.post(
    "/schedules/{schedule_id}/execute",
    response_model=ReportScheduleResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def execute_report_schedule(
    schedule_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> ReportSchedule:
```

This endpoint:
1. Loads the schedule by ID (404 if not found)
2. Calls `report_generator_service.generate_report_for_schedule()`
3. Updates `last_run`, `last_generated_document_id` 
4. Sends emails to recipients
5. Returns updated schedule

---

## Task 5: Frontend enhancements

### File: `frontend/src/lib/api/schedules.ts`
- Add `last_generated_document_id: string | null` to `ReportSchedule` interface
- Add `executeSchedule(id: string)` function:
  ```ts
  export async function executeSchedule(id: string): Promise<ReportSchedule> {
    const response = await api.post<ReportSchedule>(`/api/v1/reports/schedules/${id}/execute`);
    return response.data;
  }
  ```

### File: `frontend/src/hooks/use-schedules.ts`
- Import `executeSchedule` from api
- Add `useExecuteSchedule()` hook:
  ```ts
  export function useExecuteSchedule() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => executeSchedule(id),
      onSuccess: () => {
        toast.success("Report generated successfully");
        queryClient.invalidateQueries({ queryKey: ["report-schedules"] });
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : "Failed to execute schedule";
        toast.error(message);
      },
    });
  }
  ```

### File: `frontend/src/app/(dashboard)/reports/schedules/page.tsx`
- Import `useExecuteSchedule` hook
- Add `executeMutation = useExecuteSchedule()`
- Add `last_generated_document_id` column to table (show as truncated UUID or "None")
- Add "Execute Now" button in the Actions column next to Delete
- The Execute Now button calls `executeMutation.mutate(schedule.id)`

---

## Implementation Order
1. Model + migration (Task 1)
2. Schema update (Task 1)  
3. Report generator service (Task 2)
4. Scheduler enhancement (Task 3)
5. API endpoint (Task 4)
6. Frontend API + hook + page (Task 5)
7. Run linters and fix errors

## Verification
```bash
cd backend && ruff check . && mypy .
cd frontend && npm run lint && npm run typecheck
```
