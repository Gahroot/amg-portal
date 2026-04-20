# Partner Performance Governance & SLA Tracking Plan

## Overview
Add governance actions (warning, probation, suspension, termination, reinstatement) tied to composite partner scores (ratings + SLA compliance). Includes backend model, service, API, and frontend UI.

---

## 1. Backend: Enums & Model

### 1a. Add GovernanceAction enum to `backend/app/models/enums.py`
Append after `PreferredChannel` (line ~511):
```python
class GovernanceAction(StrEnum):
    """Partner governance actions"""
    warning = "warning"
    probation = "probation"
    suspension = "suspension"
    termination = "termination"
    reinstatement = "reinstatement"
```

### 1b. Create model `backend/app/models/partner_governance.py`
New file with `PartnerGovernance` model:
- `id` (UUID PK)
- `partner_id` (FK → partner_profiles.id, indexed)
- `action` (String(30), GovernanceAction value)
- `reason` (Text)
- `evidence` (JSON — dict with rating_ids, sla_breach_ids, notice_ids lists)
- `effective_date` (DateTime tz)
- `expiry_date` (DateTime tz, nullable)
- `issued_by` (FK → users.id)
- `created_at` (DateTime tz, default now)

Relationships: partner → PartnerProfile, issuer → User

### 1c. Register model in `backend/app/models/__init__.py`
Add: `from app.models.partner_governance import PartnerGovernance  # noqa: F401`

### 1d. Create Alembic migration `backend/alembic/versions/add_partner_governance.py`
- Revision: `add_partner_governance`
- Down revision: `add_performance_notices`
- Create table `partner_governance` with all columns and FK constraints
- Create index on `partner_id`

---

## 2. Backend: Schemas

### 2a. Create `backend/app/schemas/partner_governance.py`
Pydantic schemas:
- `GovernanceActionType` = Literal["warning", "probation", "suspension", "termination", "reinstatement"]
- `GovernanceActionCreate(BaseModel)`: action, reason, evidence (optional dict), effective_date (optional), expiry_date (optional)
- `GovernanceActionResponse(BaseModel)`: all fields + issuer_name, partner_firm_name, created_at. `model_config = {"from_attributes": True}`
- `GovernanceHistoryResponse(BaseModel)`: actions list, total
- `CompositeScoreResponse(BaseModel)`: partner_id, firm_name, avg_rating_score (float|None), sla_compliance_rate (float|None), composite_score (float|None), total_ratings, total_sla_tracked, total_sla_breached, recommended_action (str|None), current_governance_status (str|None)
- `GovernanceDashboardEntry(BaseModel)`: partner_id, firm_name, composite_score (float|None), current_action (str|None), current_action_date (str|None), sla_breach_count, avg_rating (float|None), notice_count
- `GovernanceDashboardResponse(BaseModel)`: entries list, total

---

## 3. Backend: Governance Scoring Service

### 3a. Add methods to `backend/app/services/partner_scoring_service.py`

Add imports for: `PartnerGovernance`, `SLATracker`, `PerformanceNotice`, `PartnerProfile`, `datetime`, `JSON`

**`calculate_composite_score(db, partner_id)`**:
- Query PartnerRating averages (reuse existing `calculate_partner_score`)
- Query SLATracker: join through PartnerProfile.user_id to SLATracker.assigned_to to find SLAs for this partner
- Rating component (0-100): scale avg_overall from 1-5 range → multiply by 20
- SLA component (0-100): `(1 - breached/total) * 100` if total > 0, else 100
- Composite: `0.6 * rating + 0.4 * sla` (weighted)
- Also query current governance status and recommended action
- Return dict with all components

**`evaluate_governance_action(db, partner_id)`**:
- Get composite score
- Thresholds: < 20 → suspension, < 40 → probation, < 60 → warning
- Check current status to avoid redundant actions
- Return action string or None

**`apply_governance_action(db, partner_id, action, reason, issued_by, evidence=None, expiry_date=None)`**:
- Create PartnerGovernance record with effective_date=now
- If suspension/termination: update PartnerProfile.status
- If reinstatement: set status back to "active"
- Return created record

**`get_governance_history(db, partner_id)`**: query all records ordered desc

**`get_current_governance_status(db, partner_id)`**: latest non-expired action or "good_standing"

**`get_governance_dashboard(db, skip, limit)`**: aggregate all partners with scores + status

---

## 4. Backend: API Endpoints

### 4a. Create `backend/app/api/v1/partner_governance.py`
- **GET `/dashboard`** — require_internal — GovernanceDashboardResponse (MUST be before `/{partner_id}` routes)
- **GET `/{partner_id}/governance`** — require_internal — GovernanceHistoryResponse
- **POST `/{partner_id}/governance`** — require_admin — GovernanceActionCreate body → GovernanceActionResponse
- **GET `/{partner_id}/composite-score`** — require_internal — CompositeScoreResponse

### 4b. Register in `backend/app/api/v1/router.py`
Add import and `router.include_router(partner_governance_router, prefix="/partner-governance", tags=["partner-governance"])`

---

## 5. Frontend: Types

### 5a. Create `frontend/src/types/partner-governance.ts`
Types matching backend schemas.

---

## 6. Frontend: API Client

### 6a. Create `frontend/src/lib/api/partner-governance.ts`
- `getGovernanceHistory(partnerId)` → GET
- `createGovernanceAction(partnerId, data)` → POST
- `getCompositeScore(partnerId)` → GET
- `getGovernanceDashboard(params?)` → GET

---

## 7. Frontend: Components

### 7a. `frontend/src/components/partners/partner-score-card.tsx`
- PartnerScoreCard component
- Props: composite score data
- Shows score number with color coding (green >70, amber 40-70, red <40)
- Breakdown bars for rating and SLA
- Current governance status badge
- Recommended action indicator

### 7b. `frontend/src/components/partners/governance-action-form.tsx`
- GovernanceActionForm dialog
- Props: partnerId, partnerName, open, onOpenChange
- Select for action type, textarea for reason, date pickers for effective/expiry
- useMutation with createGovernanceAction

### 7c. `frontend/src/components/partners/partner-governance-dashboard.tsx`
- PartnerGovernanceDashboard component
- Table with all partners: name, score (color), status badge, SLA breaches, avg rating, notices
- Links to partner detail

---

## 8. Frontend: Page Integration

### 8a. Add "Governance" tab to `frontend/src/app/(dashboard)/partners/[id]/page.tsx`
- Add TabsTrigger after "notices" (line ~311)
- Add TabsContent with GovernanceTabContent sub-component
- GovernanceTabContent: fetches composite score + governance history, renders PartnerScoreCard + history list + GovernanceActionForm (MD only)

### 8b. Create `frontend/src/app/(dashboard)/partners/governance/page.tsx`
- Full page rendering PartnerGovernanceDashboard

---

## 9. Verification
```bash
cd backend && ruff check . && mypy .
cd frontend && npm run lint && npm run typecheck
```

---

## File Summary

**New files (10):**
1. `backend/app/models/partner_governance.py`
2. `backend/app/schemas/partner_governance.py`
3. `backend/alembic/versions/add_partner_governance.py`
4. `backend/app/api/v1/partner_governance.py`
5. `frontend/src/types/partner-governance.ts`
6. `frontend/src/lib/api/partner-governance.ts`
7. `frontend/src/components/partners/partner-score-card.tsx`
8. `frontend/src/components/partners/governance-action-form.tsx`
9. `frontend/src/components/partners/partner-governance-dashboard.tsx`
10. `frontend/src/app/(dashboard)/partners/governance/page.tsx`

**Edited files (5):**
1. `backend/app/models/enums.py` — add GovernanceAction enum
2. `backend/app/models/__init__.py` — register PartnerGovernance
3. `backend/app/services/partner_scoring_service.py` — add 6 new methods
4. `backend/app/api/v1/router.py` — register governance router
5. `frontend/src/app/(dashboard)/partners/[id]/page.tsx` — add governance tab

## Risks
- SLA tracker uses `assigned_to` (user_id), not `partner_id`. Must join through PartnerProfile.user_id.
- Alembic migration chain: verify current head is `add_performance_notices`.
- The `/dashboard` route must be defined before `/{partner_id}` routes to avoid path conflicts.
