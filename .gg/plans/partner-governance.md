# Partner Performance Governance — Implementation Plan

## Overview
Add SLA adherence tracking, first-pass approval rates, probationary period monitoring, improvement reviews, and de-listing workflows.

---

## Phase 1: Backend — Model Changes

### 1.1 Add governance columns to `PartnerProfile` model
**File:** `backend/app/models/partner.py`

Add after `last_refreshed_at` / before `created_by` (around line 31):
```python
is_probationary = Column(Boolean, default=True)
probation_engagements_remaining = Column(Integer, default=3)
governance_status = Column(String(50), default="active")  # active, probationary, improvement_review, suspended, delisted
improvement_review_started_at = Column(DateTime(timezone=True), nullable=True)
below_threshold_count = Column(Integer, default=0)
last_below_threshold_at = Column(DateTime(timezone=True), nullable=True)
```

### 1.2 Add `GovernanceStatus` enum to `backend/app/models/enums.py`
```python
class GovernanceStatus(StrEnum):
    active = "active"
    probationary = "probationary"
    improvement_review = "improvement_review"
    suspended = "suspended"
    delisted = "delisted"
```

### 1.3 Create Alembic migration
**File:** `backend/alembic/versions/add_partner_governance_fields.py`
- `revision = "add_partner_governance_fields"`
- `down_revision = "24f7329b0cc1"` (latest migration)
- Add 6 columns to `partner_profiles` table via `op.add_column()`

---

## Phase 2: Backend — Schemas

### 2.1 Create `backend/app/schemas/partner_governance.py`
```python
class GovernanceStatusResponse(BaseModel):
    governance_status: str
    is_probationary: bool
    probation_engagements_remaining: int
    below_threshold_count: int
    improvement_review_started_at: datetime | None
    sla_adherence_rate: float | None
    first_pass_rate: float | None
    task_completion_rate: float | None
    avg_acceptance_time_hours: float | None

class DelistRequest(BaseModel):
    reason: str

class GovernanceAlertItem(BaseModel):
    partner_id: uuid.UUID
    firm_name: str
    governance_status: str
    below_threshold_count: int
    last_rating: float | None

class GovernanceAlertsResponse(BaseModel):
    alerts: list[GovernanceAlertItem]
```

### 2.2 Update `backend/app/schemas/dashboard.py` — `PartnerScorecard`
Add fields:
```python
sla_adherence_rate: float | None = None
first_pass_rate: float | None = None
task_completion_rate: float | None = None
avg_acceptance_time_hours: float | None = None
governance_status: str | None = None
is_probationary: bool | None = None
```

---

## Phase 3: Backend — Enhanced Scoring Service

### 3.1 Enhance `backend/app/services/partner_scoring_service.py`

Add 4 new functions:

**`calculate_sla_adherence(db, partner_id)`**
- Query `PartnerAssignment` where `status == "completed"` and `due_date IS NOT NULL`
- Count where `completed_at::date <= due_date`
- Return percentage (0-100)

**`calculate_first_pass_rate(db, partner_id)`**
- Query `Deliverable` joined with `PartnerAssignment` for this partner
- Count deliverables where `status == "approved"` / total deliverables where `status IN ("approved", "returned", "rejected")`

**`calculate_task_completion_rate(db, partner_id)`**
- Count `PartnerAssignment` where `status == "completed"` vs total (excluding "draft" and "cancelled")

**`calculate_avg_acceptance_time(db, partner_id)`**
- Query `PartnerAssignment` where `accepted_at IS NOT NULL`
- Calculate `avg(accepted_at - created_at)` in hours

**Update `get_partner_scorecard()`** — Add all 4 metrics + governance fields to the return dict.

---

## Phase 4: Backend — Governance Service

### 4.1 Create `backend/app/services/partner_governance_service.py`

**`check_probation_status(db, partner_id)`**
- Load `PartnerProfile`
- If `is_probationary` and `probation_engagements_remaining > 0`: decrement
- If reaches 0: set `is_probationary = False`, `governance_status = "active"`
- Commit

**`evaluate_performance_threshold(db, partner_id, threshold=3.5)`**
- Calculate `avg_overall` via `calculate_partner_score()`
- If < threshold: increment `below_threshold_count`, set `last_below_threshold_at`
- If count >= 1 and status == "active": set to "improvement_review", set `improvement_review_started_at`, create Notification for all MD users
- If count >= 2 (check within 12 months): set to "suspended", create Notification

**`delist_partner(db, partner_id, reason)`**
- Set `governance_status = "delisted"`
- Update all active assignments to "cancelled"
- Create Notifications for relevant users

**`reinstate_partner(db, partner_id)`**
- Set `governance_status = "probationary"`, `is_probationary = True`, `probation_engagements_remaining = 3`, reset `below_threshold_count = 0`

**`get_governance_alerts(db)`**
- Query all `PartnerProfile` where `governance_status IN ("improvement_review", "suspended")`
- Join with latest rating for each

---

## Phase 5: Backend — API Endpoints

### 5.1 Add to `backend/app/api/v1/partner_scoring.py`

6 new endpoints:

1. `GET /{partner_id}/governance` — `require_internal`
2. `POST /{partner_id}/evaluate` — `require_admin` (MD only)
3. `POST /{partner_id}/delist` — `require_admin` — body: `DelistRequest`
4. `POST /{partner_id}/reinstate` — `require_admin`
5. `GET /governance-alerts` — `require_internal`
6. `GET /{partner_id}/scorecard/export` — `require_internal` — returns CSV

### 5.2 Auto-trigger after rating submission
**File:** `backend/app/services/closure_service.py` — `submit_partner_rating()` (line ~170)

Add calls to `evaluate_performance_threshold()` and `check_probation_status()`.

---

## Phase 6: Frontend — API & Hooks

### 6.1 Create `frontend/src/lib/api/partner-scoring.ts`
API functions + types for governance endpoints.

### 6.2 Create `frontend/src/hooks/use-partner-governance.ts`
TanStack Query hooks: `useGovernanceStatus`, `useGovernanceAlerts`, mutations for evaluate/delist/reinstate.

---

## Phase 7: Frontend — Components & Page

### 7.1 Create `frontend/src/components/partners/governance-status-card.tsx`
- Status badge with color coding
- Probation progress, SLA/first-pass/completion rates with Progress bars
- MD-only action buttons

### 7.2 Enhance `frontend/src/app/(dashboard)/analytics/partner-performance/page.tsx`
- Governance alerts banner at top
- GovernanceStatusCard in scorecard panel

### 7.3 Update `frontend/src/lib/api/dashboard.ts` — `PartnerScorecard` interface
Add optional governance fields.

---

## File Change Summary

| File | Action |
|------|--------|
| `backend/app/models/partner.py` | Edit — add 6 governance columns |
| `backend/app/models/enums.py` | Edit — add `GovernanceStatus` enum |
| `backend/alembic/versions/add_partner_governance_fields.py` | Create — migration |
| `backend/app/schemas/partner_governance.py` | Create — governance schemas |
| `backend/app/schemas/dashboard.py` | Edit — extend `PartnerScorecard` |
| `backend/app/services/partner_scoring_service.py` | Edit — add 4 metric functions, update scorecard |
| `backend/app/services/partner_governance_service.py` | Create — governance logic |
| `backend/app/api/v1/partner_scoring.py` | Edit — add 6 endpoints |
| `backend/app/services/closure_service.py` | Edit — auto-trigger governance after rating |
| `frontend/src/lib/api/partner-scoring.ts` | Create — API functions + types |
| `frontend/src/hooks/use-partner-governance.ts` | Create — TanStack Query hooks |
| `frontend/src/components/partners/governance-status-card.tsx` | Create — governance card component |
| `frontend/src/app/(dashboard)/analytics/partner-performance/page.tsx` | Edit — add governance section |
| `frontend/src/lib/api/dashboard.ts` | Edit — extend `PartnerScorecard` type |

## Risks
- Migration depends on `24f7329b0cc1` being the latest; verify before running
- `Deliverable` has no status history log — first-pass rate uses heuristic based on current status
- `PartnerAssignment.due_date` is `Date` but `completed_at` is `DateTime` — need cast for comparison
- Notifications require querying for MD users; handle empty results
