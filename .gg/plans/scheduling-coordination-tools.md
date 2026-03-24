# Plan: Scheduling & Coordination Tools — In-Portal Appointments & Timeline

## Overview
Add full appointment CRUD, per-client cadence configuration, scheduler reminders, and frontend calendar/timeline views. ~20 new/modified files.

## Task Breakdown (Dependency Order)

### Task 1: Backend Model, Enums, Migration — Appointment
**Files:**
- **NEW** `backend/app/models/appointment.py` — `Appointment` model with all fields per spec (id, title, description, appointment_type, client_id FK→client_profiles, program_id FK→programs, organized_by FK→users, start_time, end_time, location, meeting_link, status, attendees JSON, notes, follow_up_items JSON, reminder_sent bool, created_at, updated_at). Follow `task.py` pattern using `Mapped`, `mapped_column`, `UUID(as_uuid=True)`.
- **EDIT** `backend/app/models/enums.py` — Add `AppointmentType(StrEnum)` and `AppointmentStatus(StrEnum)` enums.
- **EDIT** `backend/app/models/__init__.py` — Add `from app.models.appointment import Appointment  # noqa: F401`
- **EDIT** `backend/alembic/env.py` — Add `appointment` to the model imports (line ~12-27).
- **NEW** `backend/alembic/versions/add_appointments.py` — Migration creating `appointments` table. down_revision = `"24f7329b0cc1"`. Follow `add_travel_bookings.py` pattern. Include indexes on client_id, program_id, organized_by, start_time.

### Task 2: Backend — Client Cadence Fields + Migration
**Files:**
- **EDIT** `backend/app/models/client_profile.py` — Add 3 columns after `portal_access_enabled`:
  - `update_cadence: Mapped[str] = mapped_column(String(20), nullable=False, default="weekly", server_default="weekly")`
  - `preferred_update_day: Mapped[int | None] = mapped_column(Integer, nullable=True)`
  - `preferred_update_time: Mapped[str | None] = mapped_column(String(10), nullable=True)`
- **NEW** `backend/alembic/versions/add_client_cadence_fields.py` — Migration adding 3 columns to client_profiles. down_revision = `"add_appointments"`.

### Task 3: Backend — Appointment Schemas
**Files:**
- **NEW** `backend/app/schemas/appointment.py` — Pydantic schemas:
  - `AppointmentCreate(BaseModel)` — title, description, appointment_type, client_id (optional UUID), program_id (optional UUID), start_time (datetime), end_time (datetime), location, meeting_link, attendee_user_ids (list[UUID])
  - `AppointmentUpdate(BaseModel)` — all optional
  - `AttendeeDetail(BaseModel)` — user_id, name, email, role, rsvp
  - `FollowUpItem(BaseModel)` — description, assigned_to (UUID|None), due_date (str|None)
  - `AppointmentResponse(BaseModel)` — all fields + attendees as list[AttendeeDetail], model_config from_attributes
  - `AppointmentListResponse(BaseModel)` — appointments list + total
  - `RSVPRequest(BaseModel)` — response: Literal["accepted", "declined"]
  - `AppointmentNotesUpdate(BaseModel)` — notes (str|None), follow_up_items (list[FollowUpItem]|None)
  - `CadenceConfig(BaseModel)` — update_cadence, preferred_update_day (int|None), preferred_update_time (str|None)

### Task 4: Backend — Appointment Service
**Files:**
- **NEW** `backend/app/services/appointment_service.py` — Functions:
  - `create_appointment(db, data: AppointmentCreate, organized_by: UUID) -> Appointment`
  - `update_appointment(db, appointment_id: UUID, data: AppointmentUpdate) -> Appointment`
  - `cancel_appointment(db, appointment_id: UUID, reason: str) -> Appointment`
  - `rsvp(db, appointment_id: UUID, user_id: UUID, response: str) -> Appointment`
  - `complete_appointment(db, appointment_id: UUID, notes: str|None, follow_up_items: list|None) -> Appointment`
  - `get_upcoming_appointments(db, user_id: UUID, days_ahead: int = 7) -> list[Appointment]`
  - `get_appointment(db, appointment_id: UUID) -> Appointment|None`
  - `list_appointments(db, filters...) -> tuple[list[Appointment], int]`
  - `send_reminders(db) -> int` — find appointments starting within 1h, reminder_sent=False, send notifications
  - Uses `notification_service.create_notification()` for all notifications (follows scheduler_service pattern).

### Task 5: Backend — Appointments API Router
**Files:**
- **NEW** `backend/app/api/v1/appointments.py` — Router with endpoints:
  - `POST /` — Create (require_internal dependency)
  - `GET /` — List with query params: client_id, program_id, start_date, end_date, status, my_appointments_only. RM scoping via `get_rm_client_ids`.
  - `GET /upcoming` — Current user's upcoming (must be BEFORE `/{id}` route)
  - `GET /{id}` — Get single with attendee details (resolve user names/emails)
  - `PUT /{id}` — Update (organizer or MD)
  - `POST /{id}/rsvp` — RSVP (any attendee)
  - `POST /{id}/cancel` — Cancel with reason body
  - `POST /{id}/complete` — Complete with notes/follow-ups
  - Uses `CurrentUser`, `DB` from `app.api.deps`
- **EDIT** `backend/app/api/v1/router.py` — Add: `from app.api.v1.appointments import router as appointments_router` and `router.include_router(appointments_router, prefix="/appointments", tags=["appointments"])`

### Task 6: Backend — Cadence API Endpoints
**Files:**
- **EDIT** `backend/app/api/v1/client_preferences.py` — Add 2 new endpoints:
  - `GET /cadence/{client_id}` — Get cadence config from ClientProfile
  - `PUT /cadence/{client_id}` — Update cadence (require_rm_or_above dependency)
  - Uses `CadenceConfig` schema from `app.schemas.appointment`

### Task 7: Backend — Scheduler Reminder Job
**Files:**
- **EDIT** `backend/app/services/scheduler_service.py` — Add:
  - `_send_appointment_reminders_job()` async function — opens session, queries appointments with start_time within next hour, reminder_sent=False, status in (scheduled, confirmed). Sends notification to all attendees. Sets reminder_sent=True.
  - Register in `start_scheduler()`: `_scheduler.add_job(_send_appointment_reminders_job, "interval", minutes=30, id="send_appointment_reminders", name="Send appointment reminders", replace_existing=True)`

### Task 8: Frontend — Types + API Client + Hooks
**Files:**
- **NEW** `frontend/src/types/appointment.ts` — TypeScript interfaces: `Appointment`, `AppointmentCreate`, `AppointmentUpdate`, `AttendeeDetail`, `FollowUpItem`, `AppointmentListResponse`, `RSVPRequest`, `AppointmentNotesUpdate`, `CadenceConfig`
- **NEW** `frontend/src/lib/api/appointments.ts` — API functions using `api` from `@/lib/api`. Note: some files use `/api/v1/` prefix, others don't — check `tasks.ts` which uses bare paths like `/tasks`. Use consistent pattern matching the majority of API files.
- **NEW** `frontend/src/hooks/use-appointments.ts` — TanStack Query hooks following `use-tasks.ts` pattern.

### Task 9: Frontend — Appointment Components
**Files:**
- **NEW** `frontend/src/components/appointments/appointment-card.tsx` — Compact card: title, time, attendees count, type badge. Uses `Card`, `Badge` from ui.
- **NEW** `frontend/src/components/appointments/upcoming-widget.tsx` — Dashboard widget: uses `useUpcomingAppointments()`, shows next 5 as `AppointmentCard`s with link to detail.

### Task 10: Frontend — Appointments Pages (Dashboard)
**Files:**
- **NEW** `frontend/src/app/(dashboard)/appointments/page.tsx` — Main page with:
  - Month/week/day toggle using CSS grid calendar
  - List view alternative (chronological)
  - Filters: client, program, type
  - "New Appointment" button → links to /appointments/new
- **NEW** `frontend/src/app/(dashboard)/appointments/new/page.tsx` — Create form using existing UI components (Input, Select, Button, Label, Card, etc.)
- **NEW** `frontend/src/app/(dashboard)/appointments/[id]/page.tsx` — Detail page with status badge, attendees, notes, follow-ups, Cancel/Complete buttons.

### Task 11: Frontend — Coordination Timeline
**Files:**
- **NEW** `frontend/src/components/programs/coordination-timeline.tsx` — Horizontal timeline with CSS:
  - Milestones (diamond), Deliverable due dates (circle), Appointments (rectangle), Today line, Partner assignment bars
- **EDIT** `frontend/src/app/(dashboard)/programs/[id]/page.tsx` — Add "Timeline" tab importing `CoordinationTimeline`.

### Task 12: Frontend — Portal Appointments Page
**Files:**
- **NEW** `frontend/src/app/(portal)/portal/appointments/page.tsx` — Read-only upcoming appointments for clients.

### Task 13: Frontend — Navigation Updates
**Files:**
- **EDIT** `frontend/src/config/dashboard-nav.ts` — Add "Appointments" item to Operations group (CalendarClock icon already imported on line 17).
- **EDIT** `frontend/src/config/portal-nav.ts` — Add "Appointments" item with Calendar icon from lucide-react.

### Task 14: Lint & Typecheck
Run:
```bash
cd backend && ruff check . && mypy .
cd frontend && npm run lint && npm run typecheck
```
Fix ALL errors.

## Key Patterns to Follow
- **Backend models**: Use `Mapped[type]`, `mapped_column()`, `UUID(as_uuid=True)`, `DateTime(timezone=True)`, `default=lambda: datetime.now(UTC)`. See `task.py`.
- **Backend schemas**: Pydantic `BaseModel`, `model_config = {"from_attributes": True}` for response models. See `task.py` schema.
- **Backend API**: Use `CurrentUser`, `DB` type aliases from `app.api.deps`. Use `require_internal`, `require_rm_or_above` role checkers. See `client_preferences.py`.
- **Migrations**: Manual (not autogenerate). `op.create_table()` / `op.add_column()`. See `add_travel_bookings.py`.
- **Frontend API**: Import `api` from `@/lib/api`. Return `response.data`. See `tasks.ts`.
- **Frontend hooks**: `useQuery` / `useMutation` with `queryKey`, `queryFn`, `onSuccess` → `invalidateQueries`. `toast.error()` for errors. See `use-tasks.ts`.
- **Alembic chain**: Latest head is `24f7329b0cc1`. New migrations chain: `add_appointments` → `add_client_cadence_fields`.

## Risks
- Frontend API prefix inconsistency: `tasks.ts` uses `/tasks`, `programs.ts` uses `/api/v1/programs/`. Must match backend mount point. The router mounts at `/api/v1/` prefix (check `main.py`), so full path `/api/v1/appointments/` is needed unless there's a baseURL that already includes it.
- `react-day-picker` already in deps (used by `calendar.tsx`), so calendar views can use it.
- scheduler_service.py is ~1350 lines; additions go at the end before `start_scheduler()`.
