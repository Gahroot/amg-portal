# Secure Messaging — Scope Enforcement & Email Digest

## Overview
Add messaging scope enforcement (client↔RM only, partner↔coordinator only, unless MD authorizes direct contact) and email digest service.

## Task Breakdown

### Task 1: Backend — Model changes + Migration
**Files:**
- `backend/app/models/conversation.py` (lines 13-51)
- `backend/app/models/notification_preference.py` (lines 14-47)
- `backend/app/models/enums.py` — Add `ConversationScopeType` enum
- New: `backend/alembic/versions/add_messaging_scope_and_email_digest.py`

**Changes to `Conversation` model:**
- Add `allow_direct_contact: Mapped[bool]` column with `Boolean`, default `False`, after `participant_ids` (line 29)
- Add `scope_type: Mapped[str]` column with `String(50)`, default `"client_rm"`, after the new column
- Import `Boolean` from sqlalchemy

**Changes to `NotificationPreference` model:**
- Add `email_digest_enabled: Mapped[bool]`, `Boolean`, default `False`
- Add `email_digest_frequency: Mapped[str]`, `String(20)`, default `"daily"`
- Add `last_digest_sent_at: Mapped[datetime | None]`, `DateTime(timezone=True)`, nullable

**Add enum `ConversationScopeType` to `enums.py`** (after `ConversationType` at line 251):
```python
class ConversationScopeType(StrEnum):
    client_rm = "client_rm"
    partner_coordinator = "partner_coordinator"
    internal = "internal"
    direct = "direct"
```

**Alembic migration:** Auto-generate with `cd backend && alembic revision --autogenerate -m "add_messaging_scope_and_email_digest"`. Adds 5 columns across 2 tables.

### Task 2: Backend — Schema updates
**File:** `backend/app/schemas/conversation.py`

**Changes:**
- `ConversationCreate` (line 11): Add `allow_direct_contact: bool = False`, `scope_type: str = "client_rm"`
- `ConversationResponse` (line 30): Add `allow_direct_contact: bool = False`, `scope_type: str | None = None`
- `ConversationUpdate` (line 18): Add `allow_direct_contact: bool | None = None`, `scope_type: str | None = None`

### Task 3: Backend — Scope enforcement in conversation_service.py
**File:** `backend/app/services/conversation_service.py`

**Add `validate_conversation_participants()` method** to `ConversationService` class:

```python
async def validate_conversation_participants(
    self,
    db: AsyncSession,
    creator: User,
    participant_ids: list[uuid.UUID],
    allow_direct_contact: bool = False,
) -> str:
    """Validate participants based on creator's role. Returns scope_type.
    Raises ValueError with descriptive message on scope violation."""
```

Logic:
1. Load all participant `User` records via `select(User).where(User.id.in_(participant_ids))`
2. Determine creator role:
   - Internal roles (`INTERNAL_ROLES` from `enums.py` line 16) → allow all, return `"internal"`
   - `UserRole.client` → client path
   - `UserRole.partner` → partner path
3. **Client path:**
   - Get creator's `ClientProfile` via `select(ClientProfile).where(ClientProfile.user_id == creator.id)`
   - For each participant: must have role in `INTERNAL_ROLES` (specifically the assigned RM or a coordinator)
   - If any participant has role `client` or `partner` → raise `ValueError("Clients can only message their assigned RM or coordinator")`
   - Exception: if `allow_direct_contact=True`, partner participants are permitted
   - Return `"client_rm"` (or `"direct"` if partner participants present with direct contact)
4. **Partner path:**
   - Get creator's `PartnerProfile` via `select(PartnerProfile).where(PartnerProfile.user_id == creator.id)`
   - Get active `PartnerAssignment`s: `select(PartnerAssignment).where(PartnerAssignment.partner_id == partner_profile.id, PartnerAssignment.status.in_(["dispatched","accepted","in_progress"]))`
   - Collect `assigned_by` user IDs from those assignments (these are coordinators/RMs)
   - For each participant: must be coordinator or RM associated with their active assignments
   - If any participant has role `client` or `partner` → raise `ValueError("Partners can only message coordinators assigned to their programs")`
   - Return `"partner_coordinator"`

**Imports needed:** Add `User`, `UserRole`, `INTERNAL_ROLES` from `app.models.enums`

### Task 4: Backend — API endpoint updates
**File:** `backend/app/api/v1/conversations.py`

**Modify `create_conversation()` (lines 23-37):**
- Remove `dependencies=[Depends(require_internal)]` from the decorator — clients and partners need to create conversations too
- Before `conversation_service.create(...)`, call validation:
```python
try:
    scope_type = await conversation_service.validate_conversation_participants(
        db, current_user, data.participant_ids, data.allow_direct_contact
    )
    data.scope_type = scope_type
except ValueError as e:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
```

**Add two new endpoints after the existing ones:**

```python
@router.post("/{conversation_id}/enable-direct-contact", response_model=ConversationResponse)
async def enable_direct_contact(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
):
    """MD only: enable direct client-partner messaging."""
    if current_user.role != UserRole.managing_director:
        raise HTTPException(status_code=403, detail="Only Managing Directors can enable direct contact")
    conversation = await conversation_service.get(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conversation.allow_direct_contact = True
    conversation.scope_type = "direct"
    # Create audit log entry
    audit_log = AuditLog(
        user_id=current_user.id, user_email=current_user.email,
        action="update", entity_type="conversation",
        entity_id=str(conversation_id),
        before_state={"allow_direct_contact": False},
        after_state={"allow_direct_contact": True},
    )
    db.add(audit_log)
    await db.commit()
    await db.refresh(conversation)
    return conversation

@router.post("/{conversation_id}/disable-direct-contact", response_model=ConversationResponse)
# Similar, sets allow_direct_contact=False, scope_type back to conversation_type mapping
```

**Imports to add:** `UserRole` from `app.models.enums`, `AuditLog` from `app.models.audit_log`

### Task 5: Backend — Email digest service
**New file:** `backend/app/services/email_digest_service.py`

Follow the existing service pattern (see `communication_service.py`, `notification_service.py`).

```python
"""Email digest service for aggregating and sending notification digests."""

import logging
from datetime import UTC, datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification_preference import NotificationPreference
from app.models.notification import Notification
from app.models.communication import Communication
from app.models.conversation import Conversation
from app.models.user import User
from app.services.email_service import send_email

logger = logging.getLogger(__name__)

async def get_users_needing_digest(
    db: AsyncSession,
    frequency: str,
    now: datetime,
) -> list[NotificationPreference]:
    """Query users with email_digest_enabled who need a digest based on frequency."""
    query = select(NotificationPreference).where(
        NotificationPreference.email_digest_enabled == True,
        NotificationPreference.email_digest_frequency == frequency,
    )
    # Filter based on last_digest_sent_at timing
    if frequency == "daily":
        cutoff = now - timedelta(hours=23)
        query = query.where(
            (NotificationPreference.last_digest_sent_at == None) |
            (NotificationPreference.last_digest_sent_at < cutoff)
        )
    elif frequency == "weekly":
        cutoff = now - timedelta(days=6, hours=23)
        query = query.where(
            (NotificationPreference.last_digest_sent_at == None) |
            (NotificationPreference.last_digest_sent_at < cutoff)
        )
    # "immediate" has no timing constraint
    result = await db.execute(query)
    return list(result.scalars().all())

async def get_unread_items_for_user(
    db: AsyncSession,
    user_id,
    since: datetime | None,
) -> dict:
    """Get unread notifications and messages since a given timestamp."""
    # Unread notifications
    notif_query = select(Notification).where(
        Notification.user_id == user_id,
        Notification.is_read == False,
    )
    if since:
        notif_query = notif_query.where(Notification.created_at > since)
    # Unread messages in conversations user participates in
    # ... (query conversations then communications)
    ...

async def generate_digest_html(user_name: str, notifications: list, messages: list) -> str:
    """Generate HTML email for digest."""
    # Simple HTML template
    ...

async def send_digest_for_user(db: AsyncSession, pref: NotificationPreference) -> bool:
    """Send digest email for one user. Returns True if sent."""
    ...

async def process_digests(db: AsyncSession, frequency: str) -> int:
    """Process all pending digests for a frequency. Returns count sent."""
    now = datetime.now(UTC)
    prefs = await get_users_needing_digest(db, frequency, now)
    count = 0
    for pref in prefs:
        sent = await send_digest_for_user(db, pref)
        if sent:
            pref.last_digest_sent_at = now
            count += 1
    await db.commit()
    return count
```

### Task 6: Backend — Scheduler job
**File:** `backend/app/services/scheduler_service.py`

**Add `_send_email_digests_job()` function** following the pattern of `_check_sla_breaches_job` (line 23):

```python
async def _send_email_digests_job() -> None:
    """Periodic job: send email digests based on frequency preferences."""
    from app.services.email_digest_service import process_digests
    
    logger.info("Running email digest job")
    try:
        async with AsyncSessionLocal() as db:
            now = datetime.now(UTC)
            
            # Always process "immediate" digests
            immediate_count = await process_digests(db, "immediate")
            
            # Process "daily" digests around 8am UTC
            daily_count = 0
            if 7 <= now.hour <= 8:
                daily_count = await process_digests(db, "daily")
            
            # Process "weekly" digests on Monday around 8am UTC
            weekly_count = 0
            if now.weekday() == 0 and 7 <= now.hour <= 8:
                weekly_count = await process_digests(db, "weekly")
            
            logger.info(
                "Email digest job complete — immediate=%d, daily=%d, weekly=%d",
                immediate_count, daily_count, weekly_count,
            )
    except Exception:
        logger.exception("Email digest job failed")
```

**Register in `start_scheduler()`** — find the function and add:
```python
scheduler.add_job(
    _send_email_digests_job,
    "interval",
    hours=1,
    id="email_digests",
    name="Email digest sender",
)
```

### Task 7: Frontend — Type updates
**File:** `frontend/src/types/communication.ts`

Update `ConversationType` (line 3):
```typescript
export type ConversationType = "rm_client" | "coordinator_partner" | "internal" | "direct";
```

Update `Conversation` interface (add after line 24):
```typescript
allow_direct_contact?: boolean;
scope_type?: string;
```

Update `ConversationCreateData` (add after line 41):
```typescript
allow_direct_contact?: boolean;
scope_type?: string;
```

### Task 8: Frontend — API client updates
**File:** `frontend/src/lib/api/conversations.ts`

Add after `addParticipant` function (line 91):
```typescript
export async function enableDirectContact(conversationId: string): Promise<Conversation> {
  const response = await api.post<Conversation>(
    `/api/v1/conversations/${conversationId}/enable-direct-contact`
  );
  return response.data;
}

export async function disableDirectContact(conversationId: string): Promise<Conversation> {
  const response = await api.post<Conversation>(
    `/api/v1/conversations/${conversationId}/disable-direct-contact`
  );
  return response.data;
}
```

### Task 9: Frontend — Hooks updates
**File:** `frontend/src/hooks/use-conversations.ts`

Add hooks after `useAddParticipant` (line 109):
```typescript
export function useEnableDirectContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => enableDirectContact(conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Direct contact enabled");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to enable direct contact"),
  });
}

export function useDisableDirectContact() { /* similar */ }
```

Import `enableDirectContact`, `disableDirectContact` from API client.

### Task 10: Frontend — Dashboard communications page scope filtering
**File:** `frontend/src/app/(dashboard)/communications/page.tsx`

**Modify the recipient picker** (lines 57-71):
- Import `useAuth` (or get current user from auth context) to determine role
- Conditionally filter the `users` array:
  - If user role is `client`: only show users with role `relationship_manager` or `coordinator` (ideally just their assigned RM, but user list is sufficient for now since backend enforces)
  - If user role is `partner`: only show users with role `coordinator` or `relationship_manager`
  - If internal: show all, grouped by role
- Add scope type badge in `ConversationList` items (may require updating `ConversationList` component or adding inline badge)

### Task 11: Frontend — Portal messages page
**File:** `frontend/src/app/(portal)/portal/messages/page.tsx`

- Add descriptive text: "Your Relationship Manager is your primary point of contact"
- Show "Direct" badge on conversations where `allow_direct_contact` is true
- The existing page doesn't have a compose button, which is correct — clients just message within existing conversations

### Task 12: Frontend — Partner messages page
**File:** `frontend/src/app/(partner)/partner/messages/page.tsx`

- The existing page already describes "Communicate with your coordinators about assignments and deliverables" (line 51)
- Add a note that partners cannot initiate conversations with clients
- No compose/create button exists which is correct

### Task 13: Frontend — Portal notification settings email digest
**File:** `frontend/src/app/(portal)/portal/settings/notifications/page.tsx`

Add an "Email Digest" card section. Insert before the existing Card (line 114). Add:
- `DIGEST_FREQUENCIES` already exists (line 36). Add "immediate" option to it:
  ```typescript
  const DIGEST_FREQUENCIES = [
    { value: "immediate", label: "Immediate" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "never", label: "Never" },
  ];
  ```
- Add email digest toggle (`emailDigestEnabled` state)
- Add email digest frequency select
- Map to API fields `email_digest_enabled` and `email_digest_frequency`

### Task 14: Frontend — Partner notification settings
**File:** `frontend/src/app/(partner)/partner/settings/notifications/page.tsx`

This page already has comprehensive digest settings (lines 126-166). Add:
- An "Email Digest" subsection or relabel the existing "Notification Digest" to clarify it controls email digest
- Ensure the save payload includes `email_digest_enabled` and `email_digest_frequency`

### Task 15: Frontend — Notification preferences form component  
**File:** `frontend/src/components/settings/notification-preferences-form.tsx`

Add "Email Digest" section between existing sections (around line 213, after Per-Type controls):
- Switch for `emailDigestEnabled`
- Select for `emailDigestFrequency`
- Description: "Receive a periodic email summarizing your unread notifications and messages"

### Task 16: Run verification
```bash
cd backend && ruff check . && mypy .
cd frontend && npm run lint && npm run typecheck
```
Fix all errors.

## Risks & Mitigations
1. **Alembic migration conflicts** — Check latest migration's revision ID for `down_revision`
2. **Existing `digest_enabled`/`digest_frequency` overlap** — The `NotificationPreference` model already has these fields. The new `email_digest_enabled`/`email_digest_frequency` are specifically for email digest (vs in-portal digest). Keep both sets.
3. **`create_conversation` opening to all roles** — Removing `require_internal` is intentional since clients/partners need to create conversations. The scope validation prevents abuse.
4. **Frontend auth context** — Need to verify how to get current user's role in frontend components. Check for `useAuth` hook or similar pattern.
