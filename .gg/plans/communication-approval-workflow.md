# Communication Approval Workflow Plan

## Overview
Add a Draft → Review → Approve → Send workflow for communications. Currently communications go directly to "sent" status. This adds `pending_review`, `approved`, and `rejected` statuses, plus review columns on the Communication model.

## Task Breakdown (8 tasks, ordered by dependency)

---

### Task 1: Backend Enum + Model + Migration
**Files:**
- `backend/app/models/enums.py` — Add `CommunicationStatus` enum (after `MessageStatus` ~line 240)
- `backend/app/models/communication.py` — Add `reviewed_by`, `reviewed_at`, `rejection_reason` columns + relationship
- `backend/alembic/versions/add_communication_approval_workflow.py` — New migration

**Details:**
- Add `CommunicationStatus` StrEnum with values: `draft`, `pending_review`, `approved`, `sent`, `rejected`
- Add to `Communication` model:
  - `reviewed_by: Mapped[uuid.UUID | None]` — FK to `users.id`, nullable
  - `reviewed_at: Mapped[datetime | None]` — DateTime(timezone=True), nullable
  - `rejection_reason: Mapped[str | None]` — Text, nullable
  - `reviewer = relationship("User", foreign_keys=[reviewed_by])`
- Migration adds 3 columns to `communications` table. Use `down_revision = None` since multiple heads already exist.

---

### Task 2: Backend Schemas
**File:** `backend/app/schemas/communication.py`

**Add schemas:**
- `CommunicationDraftCreate(BaseModel)`:
  - `body: str`, `subject: str | None = None`, `recipient_user_ids: list[UUID]`, `client_id: UUID | None = None`, `program_id: UUID | None = None`, `partner_id: UUID | None = None`, `template_id: UUID | None = None`, `channel: str = "in_portal"`, `attachment_ids: list[str] | None = None`
- `CommunicationReviewAction(BaseModel)`:
  - `action: Literal["approve", "reject"]`, `rejection_reason: str | None = None`
  - Validator: if action=="reject", rejection_reason is required
- `PendingReviewResponse(BaseModel)`:
  - `communications: list[CommunicationResponse]`, `total: int`
- Update `CommunicationResponse` (line 29): add `reviewed_by: UUID | None = None`, `reviewed_at: datetime | None = None`, `rejection_reason: str | None = None`

---

### Task 3: Backend Service Methods
**File:** `backend/app/services/communication_service.py`

**Add methods to `CommunicationService`:**

1. `create_draft(db, sender_id, data: CommunicationDraftCreate) -> Communication`:
   - Creates Communication with status="draft", builds recipients JSON from `data.recipient_user_ids`
   - Does NOT send or notify

2. `submit_for_review(db, communication_id, user_id) -> Communication`:
   - Validates current status is "draft" and sender matches
   - Changes status to "pending_review"
   - Determines reviewer: if sender role is coordinator → find RM (look up via client's assigned_rm_id); if sender is RM → find MD (query users with managing_director role)
   - Creates notification to reviewer using `notification_service.create_notification()`

3. `approve_communication(db, communication_id, reviewer_id) -> Communication`:
   - Validates status is "pending_review"
   - Validates reviewer has permission (RM or MD role)
   - Sets status="approved", reviewed_by=reviewer_id, reviewed_at=now()
   - Creates notification to original sender

4. `reject_communication(db, communication_id, reviewer_id, reason) -> Communication`:
   - Validates status is "pending_review"
   - Validates reviewer has permission
   - Sets status="rejected", reviewed_by, reviewed_at, rejection_reason
   - Creates notification to original sender

5. `send_approved_communication(db, communication_id, user_id) -> Communication`:
   - Validates status is "approved" OR user is managing_director (can bypass)
   - Sets status="sent", sent_at=now()
   - Dispatches notifications to all recipients
   - For MD direct send: if status is "draft", sets reviewed_by=user_id, skips to sent

6. `get_pending_review(db, reviewer_id, client_id=None, program_id=None) -> tuple[list, int]`:
   - Queries communications with status="pending_review"
   - Filter by reviewer role: RM sees comms from coordinators; MD sees comms from RMs
   - Optional filters by client_id, program_id

---

### Task 4: Backend API Endpoints
**File:** `backend/app/api/v1/communications.py`

**Add endpoints (import new schemas, add role dependencies):**

1. `POST /draft` — calls `communication_service.create_draft()`. Uses `require_coordinator_or_above` dep.

2. `POST /{id}/submit-for-review` — calls `communication_service.submit_for_review()`. Validates sender is current user.

3. `POST /{id}/approve` — calls `communication_service.approve_communication()`. Uses `require_rm_or_above` dep.

4. `POST /{id}/reject` — accepts `CommunicationReviewAction` with rejection_reason. Uses `require_rm_or_above` dep.

5. `POST /{id}/send` — calls `communication_service.send_approved_communication()`. Available to `require_coordinator_or_above`.

6. `GET /pending-review` — calls `communication_service.get_pending_review()`. Uses `require_rm_or_above` dep. Accepts `client_id`, `program_id` query params.

**Import additions:** `CommunicationDraftCreate`, `CommunicationReviewAction`, `PendingReviewResponse` from schemas. `require_rm_or_above`, `require_coordinator_or_above` from deps.

---

### Task 5: Frontend Types
**File:** `frontend/src/types/communication.ts`

- Update `CommunicationStatus` type to add `"pending_review" | "approved" | "rejected"`
- Add to `Communication` interface: `reviewed_by?: string`, `reviewed_at?: string`, `rejection_reason?: string`
- Add `DraftCreateData` interface: `body`, `subject?`, `recipient_user_ids`, `client_id?`, `program_id?`, `partner_id?`, `template_id?`, `channel?`, `attachment_ids?`
- Add `ReviewActionData` interface: `action: "approve" | "reject"`, `rejection_reason?: string`
- Add `PendingReviewListParams`: `client_id?`, `program_id?`

---

### Task 6: Frontend API Client + Hooks
**Files:**
- `frontend/src/lib/api/conversations.ts` — Add functions at bottom
- `frontend/src/hooks/use-conversations.ts` — Add hooks at bottom

**API functions to add:**
- `createDraft(data: DraftCreateData): Promise<Communication>` — POST `/api/v1/communications/draft`
- `submitForReview(id: string): Promise<Communication>` — POST `/api/v1/communications/${id}/submit-for-review`
- `approveCommunication(id: string): Promise<Communication>` — POST `/api/v1/communications/${id}/approve`
- `rejectCommunication(id: string, data: ReviewActionData): Promise<Communication>` — POST `/api/v1/communications/${id}/reject`
- `sendCommunication(id: string): Promise<Communication>` — POST `/api/v1/communications/${id}/send`
- `getPendingReview(params?: PendingReviewListParams): Promise<CommunicationListResponse>` — GET `/api/v1/communications/pending-review`

**Hooks to add:**
- `useCreateDraft` — mutation, invalidates ["conversations"]
- `useSubmitForReview` — mutation, invalidates ["conversations", "pending-review"]
- `useApproveCommunication` — mutation, invalidates ["pending-review", "conversations"]
- `useRejectCommunication` — mutation, invalidates ["pending-review"]
- `useSendCommunication` — mutation, invalidates ["conversations"]
- `usePendingReview(params?)` — query with key ["pending-review", params]

---

### Task 7: Frontend Components
**New files:**

1. `frontend/src/components/communications/draft-list.tsx`:
   - Queries drafts (GET /communications/ filtered by status=draft)
   - Shows list with subject, recipients, created date
   - "Submit for Review" button calls submitForReview mutation
   - Uses Card components from ui library

2. `frontend/src/components/communications/review-queue.tsx`:
   - Uses `usePendingReview()` hook
   - Shows communication subject, body preview, sender name, created date
   - "Approve" button → AlertDialog confirmation → calls approveCommunication
   - "Reject" button → Dialog with required reason textarea → calls rejectCommunication
   - Filter by client_id, program_id (optional selects)

---

### Task 8: Frontend Page Update
**File:** `frontend/src/app/(dashboard)/communications/page.tsx`

**Changes:**
- Add tabs using `@/components/ui/tabs`: "Messages" (existing), "Drafts", "Pending Review"
- "Messages" tab: existing ConversationList + ConversationView
- "Drafts" tab: renders `<DraftList />`
- "Pending Review" tab: renders `<ReviewQueue />`, only visible when user role is RM or MD (use `useAuth()`)
- Update compose dialog:
  - Change behavior to create draft first via `useCreateDraft`
  - Add "Submit for Review" button after draft creation
  - For managing_director role, add "Send Directly" button that calls `sendCommunication` directly

---

## Verification

After all changes:
```bash
cd backend && ruff check . && mypy .
cd frontend && npm run lint && npm run typecheck
```

## Risks
- Migration ordering: multiple migration heads exist. May need merge migration or `--head` flag.
- The existing `send_from_template` endpoint bypasses the workflow — can be updated in follow-up.
- SLA clock for review (4 business hours) — initial implementation creates notification only; full SLA tracking is an enhancement.
