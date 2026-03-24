# Approval Delegation — Implementation Plan

## Overview

Allow internal users to temporarily delegate their approval authority to another user (delegate) while out of office. When delegation is active, the delegate can act on approvals on behalf of the delegator. Audit trail, notifications, and a settings UI are included.

---

## Architecture Decisions

- Delegation fields stored directly on `users` table (no separate table needed — one active delegation per user at a time).
- `delegation_active` bool flag + date range; service checks both flag AND date range to determine if delegation is currently effective.
- Delegates can only be other internal users (role in INTERNAL_ROLES).
- When a delegate decides an approval, `approved_by` = delegate's ID, `delegated_on_behalf_of_id` = original approver's ID (new nullable field on `program_approvals`).
- Notifications created in-portal (existing `Notification` model) via `NotificationService`.
- All delegation create/update/cancel actions are written to `AuditLog`.
- Delegation API lives at `/auth/delegation` (fits alongside `/auth/me`, `/auth/preferences`).
- The `migration down_revision = "add_shared_reports"` (current head).

---

## Files to Create / Modify

### 1. `backend/app/models/user.py` (modify)
Add delegation fields to `User`:
```python
# Approval delegation (Out-of-Office)
delegate_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
delegation_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
delegation_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
delegation_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
delegation_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
```
Add relationships:
```python
delegate: Mapped["User | None"] = relationship("User", foreign_keys=[delegate_id], remote_side="User.id", uselist=False)
```
Add TYPE_CHECKING import for `datetime`.

### 2. `backend/alembic/versions/add_approval_delegation.py` (new)
Migration:
- `revision = "add_approval_delegation"`
- `down_revision = "add_shared_reports"`
- Add columns to `users`: `delegate_id` (UUID FK→users nullable), `delegation_start` (DateTime tz nullable), `delegation_end` (DateTime tz nullable), `delegation_reason` (String(500) nullable), `delegation_active` (Boolean server_default=false)
- Add column to `program_approvals`: `delegated_on_behalf_of_id` (UUID FK→users nullable)

### 3. `backend/app/models/approval.py` (modify)
Add to `ProgramApproval`:
```python
delegated_on_behalf_of_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
```
Add relationship:
```python
original_approver = relationship("User", foreign_keys=[delegated_on_behalf_of_id])
```

### 4. `backend/app/services/delegation_service.py` (new)
```python
class DelegationService:
    def is_delegation_active(self, user: User) -> bool:
        """True if user.delegation_active AND current time is within delegation window."""
    
    async def get_delegated_principals(self, current_user_id: UUID, db: AsyncSession) -> list[User]:
        """Return list of users for whom current_user is currently an active delegate."""
    
    async def set_delegation(self, user: User, delegate_id: UUID, start: datetime, end: datetime | None, reason: str | None, db: AsyncSession) -> User:
        """Set/update delegation settings; notify delegate; write audit log."""
    
    async def cancel_delegation(self, user: User, db: AsyncSession) -> User:
        """Cancel active delegation; write audit log."""
    
    async def get_effective_approver_info(self, current_user: User, db: AsyncSession) -> tuple[UUID, UUID | None]:
        """Returns (approver_id, delegated_on_behalf_of_id).
        If current_user is themselves acting, returns (current_user.id, None).
        If current_user is a delegate for someone, they cannot use this path — callers must check.
        """
```

### 5. `backend/app/schemas/auth.py` (modify)
Add:
```python
class DelegationSettingsUpdate(BaseModel):
    delegate_id: UUID
    delegation_start: datetime
    delegation_end: datetime | None = None
    delegation_reason: str | None = None
    delegation_active: bool = True

class DelegationSettingsResponse(BaseModel):
    delegation_active: bool
    delegate_id: UUID | None
    delegate_name: str | None  # populated by endpoint
    delegation_start: datetime | None
    delegation_end: datetime | None
    delegation_reason: str | None
    # also list who is delegating TO me
    delegated_to_me_by: list[dict]  # [{id, name, until}]
    
    model_config = ConfigDict(from_attributes=True)
```

### 6. `backend/app/api/v1/auth.py` (modify)
Add 3 endpoints (after existing `/auth/preferences` endpoints):

```python
@router.get("/delegation", response_model=DelegationSettingsResponse)
async def get_delegation_settings(current_user: CurrentUser, db: DB):
    """Get current user's delegation settings + who has delegated to me."""

@router.put("/delegation", response_model=DelegationSettingsResponse)
async def set_delegation(data: DelegationSettingsUpdate, current_user: CurrentUser, db: DB):
    """Set/update delegation. Only internal roles. Validates delegate is internal."""
    # Reject if delegate == self, delegate not internal, end before start, etc.
    # Creates in-portal notification for delegate.
    # Writes AuditLog entry.

@router.delete("/delegation", status_code=204)
async def cancel_delegation(current_user: CurrentUser, db: DB):
    """Cancel active delegation."""
    # Writes AuditLog entry.
```

### 7. `backend/app/api/v1/approvals.py` (modify)
Update `decide_approval` to allow delegates:

```python
@router.patch("/{approval_id}", response_model=ApprovalResponse)
async def decide_approval(approval_id, data, db, current_user):
    ...
    # After role check, also check if current_user is an active delegate
    # of someone who HAS the right role. If so, allow the decision and
    # set delegated_on_behalf_of_id.
    
    # Logic:
    # 1. Check if current_user's role is sufficient → they act directly
    # 2. Else check if current_user is an active delegate for any user
    #    whose role IS sufficient → they act as delegate
    # 3. If neither → raise ForbiddenException
    
    approval.approved_by = current_user.id
    if acting_as_delegate_for:
        approval.delegated_on_behalf_of_id = acting_as_delegate_for.id
    approval.decided_at = datetime.now(UTC)
    # Write AuditLog with delegation note if applicable
```

### 8. `backend/app/schemas/approval.py` (modify)
Add to `ApprovalResponse`:
```python
delegated_on_behalf_of_id: UUID | None = None
delegated_on_behalf_of_name: str | None = None
```
Update `_build_approval_response` helper in `approvals.py` to populate these fields.

### 9. Frontend: `frontend/src/types/user.ts` (modify)
Add delegation fields to `User` interface:
```typescript
// Delegation fields
delegate_id?: string | null;
delegation_start?: string | null;
delegation_end?: string | null;
delegation_reason?: string | null;
delegation_active?: boolean;
```

Add new interfaces:
```typescript
export interface DelegationSettingsUpdate {
  delegate_id: string;
  delegation_start: string; // ISO datetime
  delegation_end?: string | null;
  delegation_reason?: string | null;
  delegation_active?: boolean;
}

export interface DelegationInfo {
  id: string;
  name: string;
  until: string | null;
}

export interface DelegationSettingsResponse {
  delegation_active: boolean;
  delegate_id: string | null;
  delegate_name: string | null;
  delegation_start: string | null;
  delegation_end: string | null;
  delegation_reason: string | null;
  delegated_to_me_by: DelegationInfo[];
}
```

### 10. Frontend: `frontend/src/lib/api/delegation.ts` (new)
```typescript
export async function getDelegationSettings(): Promise<DelegationSettingsResponse>
export async function setDelegation(data: DelegationSettingsUpdate): Promise<DelegationSettingsResponse>
export async function cancelDelegation(): Promise<void>
```

### 11. Frontend: `frontend/src/hooks/use-delegation.ts` (new)
```typescript
export function useDelegationSettings() - useQuery
export function useSetDelegation() - useMutation with toast
export function useCancelDelegation() - useMutation with toast
```

### 12. Frontend: `frontend/src/components/settings/delegation-settings.tsx` (new)
Card component for internal users only:
- Shows current delegation status with badge (Active / Inactive)
- If delegation is active: shows delegate name, date range, reason; Cancel button
- Form to set delegation:
  - Delegate user select (fetches `/api/v1/users/?role=...` for internal users — or a simpler approach: text field searching by email, or a combobox)
  - Start date/time picker
  - End date/time picker (optional)
  - Reason textarea (optional)
  - Enable/disable toggle
  - Submit button
- Section "Delegating to me": shows who has delegated to this user (if any), with names and date ranges
- Only rendered for users whose role is in INTERNAL_ROLES

### 13. Frontend: `frontend/src/app/(dashboard)/settings/page.tsx` (modify)
- Add "Delegation" tab (5th tab) for internal users only — icon: `UserCheck` from lucide-react
- The TabsList changes from `grid-cols-4` to `grid-cols-5` (or use conditional rendering — show the tab only for internal users)
- TabsContent renders `<DelegationSettings />`

---

## Security & Validation

- Only internal users can set delegations (check role in the PUT /delegation endpoint).
- Delegate must be an internal user and not the user themselves.
- If `delegation_end` is set, it must be after `delegation_start`.
- `is_delegation_active()` checks: `user.delegation_active == True AND (delegation_start is None OR now >= delegation_start) AND (delegation_end is None OR now <= delegation_end)`.
- A delegate cannot re-delegate (when deciding approvals as a delegate, we do NOT cascade another delegation check).

---

## Implementation Order

1. `backend/app/models/user.py` — add delegation fields
2. `backend/app/models/approval.py` — add `delegated_on_behalf_of_id`
3. `backend/alembic/versions/add_approval_delegation.py` — migration
4. `backend/app/services/delegation_service.py` — delegation logic
5. `backend/app/schemas/auth.py` — add delegation schemas
6. `backend/app/api/v1/auth.py` — add delegation endpoints
7. `backend/app/api/v1/approvals.py` — update decide logic + response helper
8. `backend/app/schemas/approval.py` — add delegation fields to response
9. `frontend/src/types/user.ts` — extend User + new interfaces
10. `frontend/src/lib/api/delegation.ts` — API client
11. `frontend/src/hooks/use-delegation.ts` — React query hooks
12. `frontend/src/components/settings/delegation-settings.tsx` — UI component
13. `frontend/src/app/(dashboard)/settings/page.tsx` — add Delegation tab
14. Run `cd backend && ruff check . && mypy .`
15. Run `cd frontend && npm run lint && npm run typecheck`
