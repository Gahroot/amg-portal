# Clarification Request Flow — Implementation Plan

## Overview
A structured flow for partners to request clarification on assignments, with RM notification and answer flow.

## Existing Patterns to Follow
- Models: `backend/app/models/decision_request.py` — structured request with status, answered_by, etc.
- Migrations: `backend/alembic/versions/add_performance_notices.py` — migration format
- API: `backend/app/api/v1/partner_portal.py` — partner-scoped endpoints using `CurrentPartner`
- Notifications: `notification_service.create_notification()` with `CreateNotificationRequest`
- Frontend: `frontend/src/components/partner/assignment-actions.tsx` — Dialog-based action UI
- Hooks: `frontend/src/hooks/use-partner-portal.ts` — TanStack Query pattern

## Files to Create/Modify

### 1. `backend/app/models/clarification_request.py` (NEW)
```python
class ClarificationRequest(Base, TimestampMixin):
    __tablename__ = "clarification_requests"
    
    id: UUID PK
    assignment_id: UUID FK partner_assignments.id CASCADE
    question: Text NOT NULL
    asked_by: UUID FK users.id NOT NULL  # partner's user id
    reference: Text nullable  # optional reference context
    status: String(20) "pending"|"answered" default "pending"
    answer: Text nullable
    answered_by: UUID FK users.id nullable
    answered_at: DateTime nullable
```

### 2. `backend/app/models/__init__.py` (MODIFY)
Add import: `from app.models.clarification_request import ClarificationRequest`

### 3. `backend/alembic/versions/add_clarification_requests.py` (NEW)
- `down_revision = "add_partner_threshold"` (current head)
- Creates `clarification_requests` table with indexes on `assignment_id` and `asked_by`

### 4. `backend/app/models/enums.py` (MODIFY)
Add `ClarificationStatus` StrEnum:
```python
class ClarificationStatus(StrEnum):
    pending = "pending"
    answered = "answered"
```

### 5. `backend/app/api/v1/partner_clarifications.py` (NEW)
Router with these endpoints:

**Partner endpoints (use CurrentPartner):**
- `POST /partner-portal/assignments/{assignment_id}/clarifications` — create clarification request; notify RM (find assigned_by user)
- `GET /partner-portal/assignments/{assignment_id}/clarifications` — list clarifications for this assignment (own only)

**Internal endpoints (use require_internal):**
- `GET /clarifications` — list all pending clarifications (for RM/coordinator dashboard)
- `GET /clarifications/{clarification_id}` — get single clarification
- `POST /clarifications/{clarification_id}/answer` — RM submits answer; notify partner

### 6. `backend/app/api/v1/router.py` (MODIFY)
Import and register both routers:
```python
from app.api.v1.partner_clarifications import (
    partner_router as partner_clarifications_router,
    internal_router as clarifications_router,
)
# add to router:
router.include_router(partner_clarifications_router, prefix="/partner-portal", tags=["partner-portal"])
router.include_router(clarifications_router, prefix="/clarifications", tags=["clarifications"])
```

### 7. `frontend/src/lib/api/partner-portal.ts` (MODIFY)
Add types and API functions:
```typescript
interface ClarificationRequest { id, assignment_id, question, reference?, status, answer?, asked_by, answered_by?, answered_at?, created_at, updated_at }
interface ClarificationListResponse { clarifications: ClarificationRequest[], total: number }
interface CreateClarificationRequest { question: string; reference?: string }

async function getAssignmentClarifications(assignmentId: string): Promise<ClarificationListResponse>
async function submitClarificationRequest(assignmentId: string, data: CreateClarificationRequest): Promise<ClarificationRequest>
```

### 8. `frontend/src/hooks/use-partner-portal.ts` (MODIFY)
Add hooks:
```typescript
useAssignmentClarifications(assignmentId: string)
useSubmitClarificationRequest()
```

### 9. `frontend/src/components/partner/clarification-request.tsx` (NEW)
Component with:
- `ClarificationRequestButton` — "Request Clarification" button that opens a Dialog
  - Textarea for question
  - Optional textarea for reference/context
  - Submit button with loading state
  - Toast on success
- `ClarificationList` — shows existing clarifications for an assignment
  - Each item: question, status badge (pending/answered), answer if available
  - Sorted: pending first, then answered

### 10. `frontend/src/app/(partner)/partner/assignments/[id]/page.tsx` (MODIFY)
- Import and render `ClarificationRequestButton` and `ClarificationList` after the Brief section
- Only show if assignment.status in ["accepted", "in_progress", "dispatched"]

## Notification Logic
**On clarification created (partner → RM):**
```python
await notification_service.create_notification(db, CreateNotificationRequest(
    user_id=assignment.assigned_by,  # the RM who created the assignment
    notification_type="assignment_update",
    title="Clarification requested",
    body=f"Partner {partner.firm_name} has requested clarification on: {assignment.title}",
    action_url=f"/assignments/{assignment_id}",
    entity_type="clarification_request",
    entity_id=clarification.id,
    priority="normal",
))
```

**On answer provided (RM → partner):**
```python
# find partner's user_id
await notification_service.create_notification(db, CreateNotificationRequest(
    user_id=partner_user_id,
    notification_type="assignment_update",
    title="Clarification answered",
    body=f"Your clarification on '{assignment.title}' has been answered",
    action_url=f"/partner/assignments/{assignment_id}",
    entity_type="clarification_request",
    entity_id=clarification.id,
    priority="normal",
))
```

## Schemas
Add to partner_clarifications.py inline (or separate schema file):
```python
class ClarificationCreate(BaseModel):
    question: str = Field(..., min_length=10, max_length=2000)
    reference: str | None = Field(None, max_length=2000)

class ClarificationAnswer(BaseModel):
    answer: str = Field(..., min_length=1, max_length=5000)

class ClarificationResponse(BaseModel):
    id: UUID
    assignment_id: UUID
    question: str
    reference: str | None
    status: str
    answer: str | None
    asked_by: UUID
    answered_by: UUID | None
    answered_at: datetime | None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
```

## Implementation Order
1. Add `ClarificationStatus` enum to `backend/app/models/enums.py`
2. Create `backend/app/models/clarification_request.py`
3. Register in `backend/app/models/__init__.py`
4. Create migration `backend/alembic/versions/add_clarification_requests.py`
5. Create `backend/app/api/v1/partner_clarifications.py` (schemas + both routers)
6. Register routers in `backend/app/api/v1/router.py`
7. Add API functions to `frontend/src/lib/api/partner-portal.ts`
8. Add hooks to `frontend/src/hooks/use-partner-portal.ts`
9. Create `frontend/src/components/partner/clarification-request.tsx`
10. Integrate component into assignment detail page
11. Run `cd backend && ruff check . && mypy .`
12. Run `cd frontend && npm run lint && npm run typecheck`
