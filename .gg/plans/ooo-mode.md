# Out-of-Office Mode — Implementation Plan

## Overview

Add out-of-office (OOO) mode so users can auto-forward tasks and approvals to a delegate while away.

---

## Files to Create / Modify

### Backend

#### 1. `backend/app/models/user.py`
Add OOO columns to the `User` model:
- `is_out_of_office: Mapped[bool]` (default False, server_default "false")
- `ooo_start: Mapped[date | None]`
- `ooo_end: Mapped[date | None]`
- `ooo_delegate_id: Mapped[uuid.UUID | None]` — FK → users.id (nullable)
- `ooo_auto_reply_message: Mapped[str | None]` — Text

Add self-referential relationship `ooo_delegate` for the delegate user.

#### 2. `backend/alembic/versions/add_ooo_fields.py`
Migration: add the 5 OOO columns to `users` table.
- `down_revision`: `"add_report_favorites"` (latest migration)

#### 3. `backend/app/schemas/auth.py`
Update `UserResponse` to expose:
```python
is_out_of_office: bool = False
ooo_start: date | None = None
ooo_end: date | None = None
ooo_delegate_id: UUID | None = None
ooo_auto_reply_message: str | None = None
```

Add new schema `OOOSettingsUpdate`:
```python
class OOOSettingsUpdate(BaseModel):
    is_out_of_office: bool | None = None
    ooo_start: date | None = None
    ooo_end: date | None = None
    ooo_delegate_id: UUID | None = None
    ooo_auto_reply_message: str | None = None
```

#### 4. `backend/app/services/ooo_service.py` (new file)
Utility service with two functions:
```python
async def resolve_assignee(db, user_id: UUID) -> UUID:
    """If user is currently OOO and has a delegate, return delegate_id, else return user_id."""

async def is_user_ooo(db, user_id: UUID) -> bool:
    """Check if user is currently OOO (flag + date range check)."""
```

OOO is "active" if `is_out_of_office=True` AND today is within [ooo_start, ooo_end] (both optional — if start is None, active from now; if end is None, indefinitely).

#### 5. `backend/app/api/v1/auth.py`
Add new endpoint:
```
PATCH /auth/ooo  → update current user's OOO settings
GET  /auth/ooo   → get current user's OOO settings
```

- `PATCH /auth/ooo`: accepts `OOOSettingsUpdate`, updates user fields, returns `UserResponse`
- If `ooo_delegate_id` is given, verify the delegate user exists and is not the current user

#### 6. `backend/app/api/v1/tasks.py`
In `create_task` and `update_task` endpoints:
- After reading `assigned_to`, call `ooo_service.resolve_assignee(db, assigned_to)` if not None
- If resolved to a different user (delegate), set `task.assigned_to = delegate_id`
- Return the task as normal (the task response will show the actual assignee)

Also add OOO warning info to `build_task_response` — add `assignee_ooo: bool` field based on the assignee's OOO status. This powers the frontend warning.

#### 7. `backend/app/api/v1/approvals.py`
In `request_approval` and `decide_approval`:
- For `request_approval`: N/A (requester is current user)
- For `decide_approval`: after finding the approval, if `approval.approved_by` will be set to current_user.id and current_user is OOO with a delegate, silently re-route to delegate? Actually for approvals, OOO routing means: when a new approval is created, we should route it to the delegate if the target approver is OOO.

Actually, the `ProgramApproval` model doesn't have a target approver — it uses role-based routing in `decide_approval`. So OOO routing for approvals means: when listing pending approvals, surface an info that the current user is delegating. The actual delegation is: if a user tries to decide an approval while OOO, forward the decision action to the delegate? That doesn't make sense.

Better approach: When `request_approval` is called, check if the relevant approver(s) are OOO and store the delegate on the approval's `approved_by` (pre-assign). But the current model uses role-based routing where anyone with the right role can decide.

**Simpler OOO for approvals**: Add an endpoint `GET /auth/ooo/delegate` to get the current delegate. On the approvals list page, show a banner "You are OOO — your approvals are being handled by [delegate]". Actually route them: when `decide_approval` is called and the user's OOO delegate would be the one acting, verify they have permission.

For now, implement the OOO service check in `decide_approval`: if `current_user.is_out_of_office` is True and they have a delegate, still allow the action (don't block) but log that the delegate handled it. The real business need is that the delegate can also see/decide approvals. Since our approval routing is role-based, the delegate naturally can decide approvals if they have the right role.

**Final decision for approvals**: No code change needed in `decide_approval` — the delegate can already decide approvals if they have the right role. The OOO state is exposed in `UserResponse`, and the frontend shows a banner/indicator.

### Frontend

#### 8. `frontend/src/types/user.ts`
Add OOO fields to `User` interface:
```typescript
is_out_of_office?: boolean;
ooo_start?: string | null;
ooo_end?: string | null;
ooo_delegate_id?: string | null;
ooo_auto_reply_message?: string | null;
```

Add new types:
```typescript
export interface OOOSettingsUpdate {
  is_out_of_office?: boolean;
  ooo_start?: string | null;
  ooo_end?: string | null;
  ooo_delegate_id?: string | null;
  ooo_auto_reply_message?: string | null;
}
```

#### 9. `frontend/src/lib/api/auth.ts`
Add:
```typescript
export async function updateOOOSettings(data: OOOSettingsUpdate): Promise<User>
export async function getOOOSettings(): Promise<User>
```

Both call `/api/v1/auth/ooo`.

#### 10. `frontend/src/hooks/use-settings.ts`
Add:
- `useOOOSettings()` — query for current OOO settings
- `useUpdateOOOSettings()` — mutation to update OOO settings

#### 11. `frontend/src/components/ui/ooo-badge.tsx` (new)
Small badge component: `<OOOBadge />` renders a styled badge with a plane/vacation icon for users that are OOO.

#### 12. `frontend/src/components/settings/ooo-settings.tsx` (new)
Full settings card with:
- Toggle switch for "Out of Office"
- Date range pickers (start/end)
- Select delegate from internal users list
- Textarea for auto-reply message
- Save button

When toggle is turned on, show the date + delegate fields. On save, call `useUpdateOOOSettings`.

#### 13. `frontend/src/app/(dashboard)/settings/page.tsx`
- Add a 5th tab "Out of Office" (using plane icon from lucide)
- Render `<OOOSettings />` in that tab
- Expand `TabsList` to 5 columns

---

## Implementation Order

1. Backend model (`user.py`)
2. Migration (`add_ooo_fields.py`)
3. Backend schemas (`auth.py`)
4. OOO service (`ooo_service.py`)
5. Backend auth endpoints (`auth.py`)
6. Task assignment OOO check (`tasks.py`)
7. Frontend types (`user.ts`)
8. Frontend API (`auth.ts`)
9. Frontend hooks (`use-settings.ts`)
10. OOO badge UI (`ooo-badge.tsx`)
11. OOO settings component (`ooo-settings.tsx`)
12. Settings page update (`settings/page.tsx`)

---

## Acceptance Criteria

- ✅ Can enable/disable OOO mode via settings UI
- ✅ OOO fields persisted in database
- ✅ When OOO active, new tasks assigned to OOO user auto-forward to delegate
- ✅ `UserResponse` exposes OOO fields
- ✅ `OOOBadge` component renders for OOO users
- ✅ Settings page has OOO tab
- ✅ Lint and typecheck pass
