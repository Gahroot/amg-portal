# Bulk Approvals Implementation Plan

## Context

The approvals page at `/approvals` currently shows **client profiles** pending MD approval, powered by `useClientProfiles({ approval_status: "pending_md_approval" })`. There is a separate program approvals API at `/api/v1/approvals/` that handles `ProgramApproval` objects.

The task requires:
1. A `POST /api/v1/approvals/bulk` backend endpoint (goes in `approvals.py` → program approvals)
2. Bulk selection UI on the approvals page
3. New `bulk-approval-bar.tsx` and `bulk-approval-dialog.tsx` components

**Architecture Decision**: The approvals page will be extended to show **two sections**:
1. **Client Onboarding** (existing, top): client profiles pending MD approval — adds checkbox bulk selection; bulk actions call individual `/api/v1/clients/{id}/md-approval` per item in sequence
2. **Program Approvals** (new, below): pending program approvals from `/api/v1/approvals/` — bulk selection uses the new `POST /api/v1/approvals/bulk` endpoint

This preserves the existing client approval flow while adding the bulk capability.

---

## Step-by-Step Implementation

### Step 1: Backend schemas — `backend/app/schemas/approval.py`

Add two new schemas at the bottom:

```python
class BulkApprovalItem(BaseModel):
    approval_id: UUID
    comments: str | None = None

class BulkApprovalRequest(BaseModel):
    items: list[BulkApprovalItem]
    action: Literal["approved", "rejected"]
    shared_comments: str | None = None  # applied when item has no per-item comments

class BulkApprovalItemResult(BaseModel):
    approval_id: UUID
    success: bool
    error: str | None = None
    result: ApprovalResponse | None = None

class BulkApprovalResponse(BaseModel):
    total: int
    succeeded: int
    failed: int
    results: list[BulkApprovalItemResult]
```

### Step 2: Backend endpoint — `backend/app/api/v1/approvals.py`

Add `POST /approvals/bulk` route after the existing `PATCH /{approval_id}` route.

Logic:
- Loop through each item in `data.items`
- For each: fetch ProgramApproval, check exists + pending, check role permissions
- Set status, approved_by, decided_at, comments
- Collect success/failure per item
- Commit all successful ones (or commit individually)
- Return `BulkApprovalResponse`

Import `BulkApprovalRequest`, `BulkApprovalResponse`, `BulkApprovalItemResult` from schemas.

### Step 3: Frontend API — `frontend/src/lib/api/approvals.ts`

Add `bulkDecideApprovals(data: BulkApprovalRequest): Promise<BulkApprovalResponse>` function calling `POST /api/v1/approvals/bulk`.

Add and export new types:
- `BulkApprovalItem`
- `BulkApprovalRequest`
- `BulkApprovalItemResult`
- `BulkApprovalResponse`

### Step 4: Frontend hook — `frontend/src/hooks/use-approvals.ts`

Add `useBulkDecideApprovals()` mutation hook that calls `bulkDecideApprovals`, invalidates `["approvals"]` on success, and shows a toast.

### Step 5: `frontend/src/components/approvals/bulk-approval-bar.tsx` (new)

A fixed bottom bar that appears when items are selected:

Props:
- `selectedCount: number`
- `onApprove: () => void`
- `onReject: () => void`
- `onClear: () => void`
- `isPending?: boolean`

UI: Animated slide-up bar at bottom of screen with:
- "X items selected" text
- Clear button
- "Reject All" button (destructive)
- "Approve All" button (primary)

### Step 6: `frontend/src/components/approvals/bulk-approval-dialog.tsx` (new)

Dialog for confirming bulk action:

Props:
- `open: boolean`
- `onOpenChange: (open: boolean) => void`
- `action: "approved" | "rejected"`
- `selectedItems: Array<{ id: string; label: string }>`
- `onConfirm: (sharedComment: string) => void`
- `isPending: boolean`
- `progress?: { completed: number; total: number; failures: Array<{ id: string; error: string }> }`

UI:
- Title: "Approve X items" / "Reject X items"
- List of selected items (scrollable if > 5)
- Shared comment textarea
- Progress bar (shown when processing)
- Failure list after completion (if any)
- Cancel / Confirm buttons

### Step 7: Update approvals page — `frontend/src/app/(dashboard)/approvals/page.tsx`

Major update:
1. Add `selectedClientIds: Set<string>` state
2. Add `selectedApprovalIds: Set<string>` state  
3. Add `bulkAction: "approved" | "rejected" | null` state
4. Add `dialogOpen: boolean` state

**Client Profiles section** (top, unchanged title "MD Approvals"):
- Add checkbox column to table header ("Select all" checkbox)
- Add checkbox per row
- Row click selects/deselects

**Program Approvals section** (new, title "Program Approvals"):
- Use `useApprovals()` hook to fetch program approvals
- Show table with: checkbox, program ID (truncated), type, requester, requested date, status badge
- Same select all / per-row checkbox pattern

**BulkApprovalBar**: shown when either `selectedClientIds.size > 0` or `selectedApprovalIds.size > 0`

**BulkApprovalDialog**: opened when user clicks Approve/Reject in bar

**Bulk action logic**:
- If program approvals selected: call `useBulkDecideApprovals` mutation
- If client profiles selected: call individual `submitMDApproval` in sequence, tracking progress

---

## File Summary

| File | Action |
|------|--------|
| `backend/app/schemas/approval.py` | Add 4 new schemas |
| `backend/app/api/v1/approvals.py` | Add POST /bulk endpoint |
| `frontend/src/lib/api/approvals.ts` | Add bulkDecideApprovals + types |
| `frontend/src/hooks/use-approvals.ts` | Add useBulkDecideApprovals hook |
| `frontend/src/components/approvals/bulk-approval-bar.tsx` | New component |
| `frontend/src/components/approvals/bulk-approval-dialog.tsx` | New component |
| `frontend/src/app/(dashboard)/approvals/page.tsx` | Major update |
