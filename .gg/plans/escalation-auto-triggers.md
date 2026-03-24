# Escalation Auto-Triggers & 4-Level Chain Progression

## Overview
Add automatic escalation progression, SLA breach→escalation bridging, response time enforcement, scheduler jobs, new API endpoints, and frontend enhancements.

## Files to Modify (Existing)
- `backend/app/models/escalation.py` — Add `response_deadline`, `parent_escalation_id` columns
- `backend/app/schemas/escalation.py` — Add new schemas, update `EscalationResponse`
- `backend/app/services/escalation_service.py` — Add `auto_progress_escalation()`, `create_escalation_from_sla_breach()`, `get_escalation_metrics()`, `get_overdue_escalations()`, `reassign_escalation()`
- `backend/app/services/scheduler_service.py` — Add `_auto_progress_escalations_job()`, wire SLA breach→escalation in `_check_sla_breaches_job()`, register new job in `start_scheduler()`
- `backend/app/api/v1/escalations.py` — Add `/metrics`, `/overdue`, `/{id}/reassign` endpoints
- `frontend/src/types/escalation.ts` — Add `EscalationMetrics`, `response_deadline`, `is_overdue` fields
- `frontend/src/lib/api/escalations.ts` — Add `getEscalationMetrics()`, `getOverdueEscalations()`, `reassignEscalation()`
- `frontend/src/hooks/use-escalations.ts` — Add `useEscalationMetrics()`, `useOverdueEscalations()`, `useReassignEscalation()`
- `frontend/src/app/(dashboard)/escalations/page.tsx` — Add metrics cards, overdue filter tab
- `frontend/src/app/(dashboard)/escalations/[id]/page.tsx` — Add deadline countdown, overdue badge, reassign button

## Files to Create
- `backend/alembic/versions/add_escalation_response_deadline.py` — Migration for new columns
- `frontend/src/components/escalations/escalation-metrics.tsx` — Metrics cards component
- `frontend/src/components/escalations/escalation-chain-timeline.tsx` — Chain timeline component

---

## Task Breakdown

### Task 1: Backend Model + Migration
**File: `backend/app/models/escalation.py`**
- Add `response_deadline: Mapped[datetime | None]` — `DateTime(timezone=True), nullable=True`
- Add `parent_escalation_id: Mapped[uuid.UUID | None]` — `UUID(as_uuid=True), ForeignKey("escalations.id"), nullable=True`
- Add `@property is_overdue` that returns `bool` — checks `response_deadline` vs `datetime.now(UTC)` when status is open/acknowledged/investigating

**File: `backend/alembic/versions/add_escalation_response_deadline.py`**
- New migration adding `response_deadline` (DateTime nullable) and `parent_escalation_id` (UUID nullable, FK to escalations.id) columns to `escalations` table
- Use `down_revision = None` to create a standalone migration (multiple heads already exist)

### Task 2: Backend Schema Updates
**File: `backend/app/schemas/escalation.py`**

Add to `EscalationResponse`:
- `response_deadline: datetime | None = None`
- `is_overdue: bool = False`

Add new schemas:
- `EscalationMetricsResponse`: `open_by_level: dict[str, int]`, `avg_resolution_time_hours: float | None`, `overdue_count: int`, `sla_compliance_pct: float | None`, `trend_this_week: int`, `trend_last_week: int`
- `OverdueEscalationResponse`: `escalations: list[EscalationResponse]`, `total: int`
- `ReassignRequest`: `new_owner_id: UUID`

### Task 3: Backend Service — Auto-Progression + SLA Bridge
**File: `backend/app/services/escalation_service.py`**

**Constants** (add near top after imports):
```python
RESPONSE_DEADLINES_HOURS: dict[str, int] = {
    "task": 1, "milestone": 1, "program": 2, "client_impact": 0,
}
ESCALATION_PROGRESSION: dict[str, tuple[str, int]] = {
    "task": ("milestone", 4),
    "milestone": ("program", 4),
    "program": ("client_impact", 8),
}
```

**`calculate_response_deadline(level, triggered_at) -> datetime`** — adds hours based on level

**Modify `create_escalation()`** (around line 55, before db.add):
- Set `escalation.response_deadline = calculate_response_deadline(level.value, escalation.triggered_at)`

**`auto_progress_escalation(db, escalation_id) -> Escalation | None`**:
- Fetch escalation, check status is open/acknowledged, check level is in ESCALATION_PROGRESSION
- Calculate hours since triggered_at; if exceeds threshold, create new escalation at next level
- Set parent_escalation_id on new escalation
- Append `{"action": "auto_progressed", "at": ..., "to_level": ..., "child_id": ...}` to parent's chain

**`create_escalation_from_sla_breach(db, sla_tracker) -> Escalation`**:
- Map entity_type → escalation level
- Dedup: check existing open escalation for same entity
- Create via `create_escalation()`

**`get_escalation_metrics(db) -> dict`** — queries for open-by-level, avg resolution time, overdue count, SLA compliance %, weekly trends

**`get_overdue_escalations(db, skip, limit) -> tuple[list[dict], int]`** — same pattern as `get_escalations_with_owner_info`

**`reassign_escalation(db, escalation_id, new_owner_id, user) -> Escalation`** — update owner, append to chain, notify via WS

### Task 4: Backend Scheduler Jobs
**File: `backend/app/services/scheduler_service.py`**

**Add `_auto_progress_escalations_job()`** — Query open/acknowledged escalations past deadline, call `auto_progress_escalation()` for each

**Wire SLA breach→escalation in `_check_sla_breaches_job()`** — After line 43 (`newly_breached` list built), before the `if not newly_breached: return`, loop and call `create_escalation_from_sla_breach()`

**Register in `start_scheduler()`** — Add 15-minute interval job for `_auto_progress_escalations_job`

### Task 5: Backend API Endpoints
**File: `backend/app/api/v1/escalations.py`**

- `GET /metrics` — returns `EscalationMetricsResponse`
- `GET /overdue` — returns `OverdueEscalationResponse`
- `POST /{escalation_id}/reassign` — MD only (use `require_admin`), returns `EscalationResponse`
- Update all `EscalationResponse` constructions to include `response_deadline` and `is_overdue`

### Task 6: Frontend Types + API + Hooks
**File: `frontend/src/types/escalation.ts`** — Add `response_deadline`, `is_overdue` to Escalation; add `EscalationMetrics` interface

**File: `frontend/src/lib/api/escalations.ts`** — Add `getEscalationMetrics()`, `getOverdueEscalations()`, `reassignEscalation()`

**File: `frontend/src/hooks/use-escalations.ts`** — Add `useEscalationMetrics()`, `useOverdueEscalations()`, `useReassignEscalation()`

### Task 7: Frontend — Escalation Metrics Component
**File: `frontend/src/components/escalations/escalation-metrics.tsx`**
- 4-card grid: Open by Level, Avg Resolution Time, Overdue Count (red if >0), Weekly Trend
- Uses `useEscalationMetrics()` hook

### Task 8: Frontend — Escalation Chain Timeline Component
**File: `frontend/src/components/escalations/escalation-chain-timeline.tsx`**
- Vertical timeline with icons per action type
- Props: `chain: TimelineItem[]`
- Extract timeline rendering from detail page

### Task 9: Frontend — Enhance Escalations List Page
**File: `frontend/src/app/(dashboard)/escalations/page.tsx`**
- Add `<EscalationMetrics />` at top
- Add "Overdue" status filter option
- Highlight overdue rows with red styling
- Show response_deadline column

### Task 10: Frontend — Enhance Escalation Detail Page
**File: `frontend/src/app/(dashboard)/escalations/[id]/page.tsx`**
- Use `<EscalationChainTimeline />` component
- Show response deadline with countdown
- Show "Overdue" badge if `is_overdue`
- "Reassign" button for MDs with `useReassignEscalation()`

---

## Implementation Order
1. Task 1 (Model + Migration)
2. Task 2 (Schemas)
3. Task 3 (Service logic)
4. Task 4 (Scheduler)
5. Task 5 (API endpoints)
6. Task 6 (Frontend types/API/hooks)
7. Tasks 7+8 (Components — can parallel)
8. Task 9 (List page)
9. Task 10 (Detail page)

## Key Implementation Notes
- `require_admin` exists at `backend/app/api/deps.py:131` — use for reassign endpoint
- `_check_sla_breaches_job` has early return at line 44; SLA→escalation bridge must go after `newly_breached` list (line 43) but BEFORE the early return
- Multiple alembic heads exist; use `down_revision = None` for standalone migration
- `get_escalations_with_owner_info` at line 501 of escalation_service.py is the pattern for building response dicts with owner info
- The `is_overdue` property on model should NOT be a mapped column — use `@property` to avoid SQLAlchemy issues
- SLATracker model is at `backend/app/models/sla_tracker.py` with fields: `entity_type`, `entity_id`, `communication_type`, `breach_status`, `assigned_to`

## Verification
```bash
cd backend && ruff check . && mypy .
cd frontend && npm run lint && npm run typecheck
```
