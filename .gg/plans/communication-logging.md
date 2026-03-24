# External Communication Logging — Implementation Plan

## Overview
Add a complete communication logging system to track off-portal interactions (phone, email, WhatsApp, in-person, video calls) with clients, partners, and programs. Enforces the design doc rule that no RM-to-client external communication happens without a portal record.

## Files to Create

### Backend
1. **`backend/app/models/communication_log.py`** — New SQLAlchemy model
2. **`backend/app/schemas/communication_log.py`** — Pydantic schemas
3. **`backend/app/api/v1/communication_logs.py`** — API router with CRUD + overdue followups
4. **`backend/alembic/versions/add_communication_logs.py`** — Migration (down_revision: `24f7329b0cc1`)

### Frontend
5. **`frontend/src/types/communication-log.ts`** — TypeScript types
6. **`frontend/src/lib/api/communication-logs.ts`** — API client functions
7. **`frontend/src/hooks/use-communication-logs.ts`** — TanStack Query hooks
8. **`frontend/src/components/communications/log-communication-dialog.tsx`** — Create/edit form dialog
9. **`frontend/src/components/communications/log-detail-panel.tsx`** — Slide-over detail panel
10. **`frontend/src/app/(dashboard)/communications/logs/page.tsx`** — List page

### Files to Modify
11. **`backend/app/models/__init__.py`** — Register CommunicationLog (line ~21, after Communication import)
12. **`backend/app/schemas/__init__.py`** — Register communication_log schemas (line ~34, after communication schemas)
13. **`backend/app/api/v1/router.py`** — Include communication_logs router
14. **`backend/app/services/scheduler_service.py`** — Add `_check_communication_logging_compliance_job()`
15. **`frontend/src/config/dashboard-nav.ts`** — Add "Communication Logs" nav item in Communication group

---

## Step-by-Step Implementation

### Step 1: Backend Model (`backend/app/models/communication_log.py`)

Follow existing model patterns (see `communication.py` for FK/relationship conventions):

```python
class CommunicationLog(Base):
    __tablename__ = "communication_logs"
    
    id: UUID PK (uuid4)
    channel: String(50) not null  # phone, email, whatsapp, in_person, video_call, other
    direction: String(20) not null  # inbound, outbound
    logged_by: UUID FK users.id not null
    client_id: UUID FK client_profiles.id nullable
    program_id: UUID FK programs.id nullable
    partner_id: UUID FK partner_profiles.id nullable
    subject: String(500) nullable
    summary: Text not null
    participants: JSON nullable  # list of participant names/roles
    occurred_at: DateTime(timezone=True) not null
    duration_minutes: Integer nullable
    follow_up_required: Boolean default False
    follow_up_notes: Text nullable
    follow_up_due_date: Date nullable
    follow_up_completed: Boolean default False  # needed for overdue tracking
    attachment_ids: JSON nullable
    is_deleted: Boolean default False  # soft delete
    created_at: DateTime(timezone=True)
    updated_at: DateTime(timezone=True)
```

Relationships: `logger` → User, `client` → ClientProfile, `program` → Program, `partner` → PartnerProfile

### Step 2: Register Model (`backend/app/models/__init__.py`)

Add after line 20 (after `from app.models.communication import Communication`):
```python
from app.models.communication_log import CommunicationLog  # noqa: F401
```

### Step 3: Alembic Migration (`backend/alembic/versions/add_communication_logs.py`)

- revision: `"add_communication_logs"`
- down_revision: `"24f7329b0cc1"`
- Create `communication_logs` table with all columns
- Add indexes on: `logged_by`, `client_id`, `program_id`, `partner_id`, `channel`, `occurred_at`, `follow_up_due_date`

### Step 4: Schemas (`backend/app/schemas/communication_log.py`)

- `CommunicationLogCreate` — channel (Literal enum), direction (Literal), client_id?, program_id?, partner_id?, subject?, summary (required), participants?, occurred_at, duration_minutes?, follow_up_required, follow_up_notes?, follow_up_due_date?, override_time_warning? (bool, for 48hr check)
- `CommunicationLogUpdate` — all optional fields
- `CommunicationLogResponse` — all fields + logged_by_name: str | None, logged_by_email: str | None, client_name: str | None, partner_name: str | None, program_name: str | None. model_config = {"from_attributes": True}
- `CommunicationLogListResponse` — logs: list[CommunicationLogResponse], total: int

Register in `backend/app/schemas/__init__.py` after line 34.

### Step 5: API Router (`backend/app/api/v1/communication_logs.py`)

Use patterns from `communications.py` and `escalations.py`:
- Import `DB`, `CurrentUser`, `RLSContext`, `require_internal`, `require_admin` from `app.api.deps`
- Import `UserRole`, `INTERNAL_ROLES` from `app.models.enums`

**Endpoints:**
1. `POST /` — Create log. Dependency: `require_internal`. Auto-set `logged_by = current_user.id`. Validate `occurred_at` not > 48hrs ago unless `override_time_warning=True` in body. If `follow_up_required` and `follow_up_due_date` is set, that's the SLA clock.
2. `GET /` — List with query params: client_id, program_id, partner_id, channel, direction, date_from, date_to, follow_up_required, skip, limit. Filter: if user is RM, scope to their clients only (use `get_rm_client_ids` from deps). Join User for logged_by_name/email, ClientProfile for client_name, etc.
3. `GET /overdue-followups` — MUST be before `/{id}` route to avoid path conflict. Filter: follow_up_required=True, follow_up_due_date < today, follow_up_completed=False, is_deleted=False.
4. `GET /{id}` — Single log with joined user info.
5. `PUT /{id}` — Update. Only logger or MD can edit (check current_user.id == log.logged_by or current_user.role == "managing_director").
6. `DELETE /{id}` — Soft delete (set is_deleted=True). Only logger or MD.

Register in `backend/app/api/v1/router.py` — add import and `router.include_router(communication_logs_router, prefix="/communication-logs", tags=["communication-logs"])`.

### Step 6: Scheduler Service (`backend/app/services/scheduler_service.py`)

Add function `_check_communication_logging_compliance_job()`:
- Query active clients (via Client model) with programs in active/design status
- For each RM with active clients, check if there are CommunicationLog entries in last 7 days for those clients
- If none, create a notification for the RM reminding them to log external communications
- Register the job in the scheduler startup function (find `start_scheduler` or equivalent and add the job with `CronTrigger` or `IntervalTrigger` for daily execution)

### Step 7: Frontend Types (`frontend/src/types/communication-log.ts`)

```typescript
export type CommunicationChannel = "phone" | "email" | "whatsapp" | "in_person" | "video_call" | "other";
export type CommunicationDirection = "inbound" | "outbound";

export interface CommunicationLog {
  id: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  logged_by: string;
  logged_by_name: string | null;
  logged_by_email: string | null;
  client_id: string | null;
  client_name: string | null;
  program_id: string | null;
  program_name: string | null;
  partner_id: string | null;
  partner_name: string | null;
  subject: string | null;
  summary: string;
  participants: string[] | null;
  occurred_at: string;
  duration_minutes: number | null;
  follow_up_required: boolean;
  follow_up_notes: string | null;
  follow_up_due_date: string | null;
  follow_up_completed: boolean;
  attachment_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CommunicationLogCreate { ... all form fields ... }
export interface CommunicationLogUpdate { ... all optional ... }
export interface CommunicationLogListResponse { logs: CommunicationLog[]; total: number; }
export interface CommunicationLogListParams { skip, limit, channel, direction, client_id, program_id, partner_id, date_from, date_to, follow_up_required }
```

### Step 8: API Client (`frontend/src/lib/api/communication-logs.ts`)

Follow `escalations.ts` pattern:
- `createLog(data)` → POST /api/v1/communication-logs/
- `listLogs(params?)` → GET /api/v1/communication-logs/
- `getLog(id)` → GET /api/v1/communication-logs/{id}
- `updateLog(id, data)` → PUT /api/v1/communication-logs/{id}
- `deleteLog(id)` → DELETE /api/v1/communication-logs/{id}
- `getOverdueFollowups()` → GET /api/v1/communication-logs/overdue-followups

### Step 9: Hooks (`frontend/src/hooks/use-communication-logs.ts`)

Follow `use-escalations.ts` pattern with TanStack Query:
- `useCommunicationLogs(filters)` — useQuery with queryKey ["communication-logs", filters]
- `useCommunicationLog(id)` — useQuery, enabled: !!id
- `useCreateCommunicationLog()` — useMutation, invalidate ["communication-logs"], toast on error
- `useUpdateCommunicationLog()` — useMutation
- `useDeleteCommunicationLog()` — useMutation
- `useOverdueFollowups()` — useQuery

### Step 10: Log Communication Dialog (`frontend/src/components/communications/log-communication-dialog.tsx`)

Dialog component with form:
- Channel select (Phone, Email, WhatsApp, In Person, Video Call, Other)
- Direction radio (Inbound/Outbound)
- Client searchable select (from useClients hook)
- Program select (filtered by client)
- Subject text input
- Summary textarea (required)
- Participants — comma-separated text input (simpler than tag input)
- Date & Time input (defaults to now)
- Duration (number, minutes)
- Follow-up checkbox → conditionally reveals notes textarea + due date picker
- Submit calls useCreateCommunicationLog

Use existing UI components: Dialog, Select, Input, Textarea, Button, Label, Checkbox from `@/components/ui/`

### Step 11: Log Detail Panel (`frontend/src/components/communications/log-detail-panel.tsx`)

Sheet/slide-over component (use Sheet from `@/components/ui/sheet`):
- Shows all log fields in formatted layout
- Channel with icon, direction badge
- Client/Program/Partner display
- Participants list
- Follow-up section with status
- Edit button (opens dialog pre-filled)
- Delete button with confirmation

### Step 12: Logs List Page (`frontend/src/app/(dashboard)/communications/logs/page.tsx`)

Follow escalations page pattern:
- Filter bar: channel dropdown, direction dropdown, client select, date range inputs, follow_up_required toggle
- Table with columns: Date/Time, Channel (icon), Direction, Client/Partner, Subject, Summary (truncated), Follow-up status, Logged By
- Pagination (skip/limit)
- Click row → open detail panel (Sheet)
- "Log Communication" button → opens dialog
- Role check: internal roles only (ALLOWED_ROLES)

### Step 13: Navigation (`frontend/src/config/dashboard-nav.ts`)

In the Communication group (after the Messages item at line ~286), add:
```typescript
{
  title: "Communication Logs",
  href: "/communications/logs",
  icon: PhoneCall,
  tooltip: "External Communication Logs",
  roles: [MD, RM, COORD, FIN],
},
```
Import `PhoneCall` from lucide-react at the top of the file.

---

## Verification

```bash
cd backend && ruff check . && mypy .
cd frontend && npm run lint && npm run typecheck
```

Fix ALL errors before completing.

## Risks & Mitigations
- **Migration chain**: `24f7329b0cc1` is current head — verify before creating migration
- **RM client scoping**: `get_rm_client_ids` in deps.py uses `Client.rm_id` — the API needs to map from Client IDs to ClientProfile IDs if they differ. Check the Client model relationship.
- **Sheet component**: Verify `@/components/ui/sheet` exists before using in detail panel
- **Participants input**: No existing tag input component — use simple comma-separated textarea
