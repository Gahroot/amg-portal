# Client Birthday & Important Dates Reminders — Implementation Plan

## Overview
Add birthday and important date tracking for clients with automatic daily scheduler reminders, a dashboard widget, and a client-detail tab.

---

## Files to Create / Modify

### Backend

#### 1. `backend/app/models/client_profile.py` — Add date fields
Add two new columns:
- `birth_date: Mapped[date | None]` — using `from datetime import date` + `sqlalchemy.Date`
- `important_dates: Mapped[list[dict] | None]` — JSON column, each entry: `{label: str, month: int, day: int, year: int | null, recurring: bool}`
- `birthday_reminders_enabled: Mapped[bool]` — privacy flag, default True

Imports to add: `from datetime import date`, `Date` from sqlalchemy.

#### 2. `backend/alembic/versions/add_client_dates.py` — Migration
- `revision = "add_client_dates"`
- `down_revision = "add_predicted_risks"` (latest migration)
- `op.add_column("client_profiles", sa.Column("birth_date", sa.Date(), nullable=True))`
- `op.add_column("client_profiles", sa.Column("important_dates", JSONB, nullable=True))`
- `op.add_column("client_profiles", sa.Column("birthday_reminders_enabled", sa.Boolean(), nullable=False, server_default="true"))`

#### 3. `backend/app/schemas/client_profile.py` — Update schemas
- Add `ImportantDate` Pydantic model: `{label: str, month: int, day: int, year: int | None, recurring: bool}`
- Add `birth_date: date | None = None` to `ClientProfileCreate`, `ClientProfileUpdate`, `ClientProfileResponse`
- Add `important_dates: list[ImportantDate] | None = None` to same three schemas
- Add `birthday_reminders_enabled: bool = True` to `ClientProfileUpdate` and `ClientProfileResponse`

#### 4. `backend/app/services/client_dates_service.py` — New service
```python
async def get_upcoming_dates(db, days_ahead=7, rm_id=None) -> list[UpcomingDateItem]:
    """Query client_profiles for birth_date and important_dates matching today or +7 days.
    
    Logic:
    - For each client profile (optionally filtered by assigned_rm_id):
      - If birth_date is set and birthday_reminders_enabled: check if (month, day) falls 
        within today to today+days_ahead (year-agnostic)
      - For each important_date entry: check if (month, day) falls within range,
        and compute years_since if year is set
    - Return list of UpcomingDateItem with: 
        client_id, client_name, rm_id, date_type, label, days_until, 
        occurs_on (date), years_since (int|None)
    """

async def send_date_reminders(db, days_ahead=7) -> None:
    """Called by scheduler to send notifications for upcoming dates."""
    items = await get_upcoming_dates(db, days_ahead)
    for item in items:
        # Check deduplication: skip if notification already sent today for this client+date_type
        await notification_service.create_notification(db, CreateNotificationRequest(
            user_id=item.rm_id,
            notification_type="system",
            title=f"{'🎂 Birthday' if item.date_type == 'birthday' else '📅 ' + item.label}: {item.client_name}",
            body=...,  # includes days_until, years_since if applicable
            priority="normal",
            entity_type="client",
            entity_id=item.client_id,
        ))
```

Schemas defined in service file (simple dataclasses/TypedDicts):
```python
@dataclass
class UpcomingDateItem:
    client_id: UUID
    client_name: str
    rm_id: UUID
    date_type: str  # "birthday" | label of important date
    label: str
    days_until: int
    occurs_on: date
    years_since: int | None
```

#### 5. `backend/app/services/scheduler_service.py` — Add job
Add a new job function `_check_client_dates_job()` that calls `send_date_reminders(db, days_ahead=7)`. Register it as a daily cron at 7:30 AM.

Import `from app.services.client_dates_service import send_date_reminders`.

#### 6. `backend/app/api/v1/clients.py` — Add upcoming dates endpoint
```
GET /clients/upcoming-dates?days_ahead=14&rm_id=...
→ returns list[UpcomingDateItem] (as dict)
```
Requires `require_internal` dependency. RMs see only their own clients.

#### 7. `backend/app/api/v1/router.py` — No changes needed (clients router already included)

---

### Frontend

#### 8. `frontend/src/types/client.ts` — Add types
```typescript
export interface ImportantDate {
  label: string;
  month: number;
  day: number;
  year: number | null;
  recurring: boolean;
}

export interface UpcomingDateItem {
  client_id: string;
  client_name: string;
  rm_id: string;
  date_type: string;
  label: string;
  days_until: number;
  occurs_on: string;  // ISO date string
  years_since: number | null;
}

// Add to ClientProfile interface:
// birth_date: string | null;
// important_dates: ImportantDate[] | null;
// birthday_reminders_enabled: boolean;
```

#### 9. `frontend/src/lib/api/clients.ts` — Add API function
```typescript
export async function getUpcomingDates(params?: { days_ahead?: number }): Promise<UpcomingDateItem[]>
```
Calls `GET /api/v1/clients/upcoming-dates`.

#### 10. `frontend/src/hooks/use-clients.ts` — Add hook
```typescript
export function useUpcomingDates(daysAhead = 14) {
  return useQuery({
    queryKey: ["clients", "upcoming-dates", daysAhead],
    queryFn: () => getUpcomingDates({ days_ahead: daysAhead }),
    refetchInterval: 60_000,
  });
}

// Also add useUpdateClientDates mutation for PATCH /clients/{id}
```

#### 11. `frontend/src/components/clients/important-dates-form.tsx` — New component
Form for adding/editing birth_date and important_dates array on a client profile.

UI elements:
- Birth date input (`<input type="date">` or date picker)
- Toggle: "Birthday reminders enabled"
- Section: "Important Dates" with array of entries (add/remove)
  - Each entry: label (text), month (1–12), day (1–31), year (optional), recurring (checkbox)
- Save button calls `PATCH /clients/{id}` with updated fields

#### 12. `frontend/src/components/dashboard/upcoming-dates-widget.tsx` — New component
Shows upcoming client dates for the current RM.

UI:
- Card with title "Upcoming Client Dates" + calendar icon
- Each row: client name, date type/label, days until, "Send Message" quick action link
- Coloured badge: "Today" (amber), "Tomorrow" (blue), "This week" (outline)
- Empty state: "No upcoming dates in the next 14 days"
- Loading skeleton

#### 13. `frontend/src/app/(dashboard)/clients/[id]/page.tsx` — Add "Dates" tab
- Add `"dates"` to `Tab` type
- Add `{ key: "dates", label: "Important Dates" }` to tabs array (visible to internal senior users)
- Render `<ImportantDatesForm clientId={id} profile={profile} />` when tab is "dates"

#### 14. `frontend/src/app/(dashboard)/page.tsx` — Add widget to dashboard
Add `<UpcomingDatesWidget />` for internal users (RMs and MDs) in the loaded state, below the RAG breakdown, alongside or below the activity/alerts section.

---

## Implementation Order

1. Backend model (`client_profile.py`)
2. Backend migration (`add_client_dates.py`)
3. Backend schemas (`client_profile.py`)
4. Backend service (`client_dates_service.py`)
5. Backend scheduler job (`scheduler_service.py`)
6. Backend API endpoint (`clients.py`)
7. Frontend types (`client.ts`)
8. Frontend API function (`lib/api/clients.ts`)
9. Frontend hook (`hooks/use-clients.ts`)
10. Frontend form component (`important-dates-form.tsx`)
11. Frontend dashboard widget (`upcoming-dates-widget.tsx`)
12. Frontend client detail page (add Dates tab)
13. Frontend dashboard page (add widget)

---

## Key Design Decisions

- **Year-agnostic birthday matching**: Compare only `(month, day)` against the next N days, handling year-boundary (e.g., Dec 31 → Jan 1).
- **Deduplication**: The scheduler checks whether a notification for a given `(client_id, date_type, today's_date)` was already sent. Use a simple pattern: notification body contains a unique marker, or check existing notifications from today with matching title prefix.
- **Privacy**: `birthday_reminders_enabled = False` suppresses birthday notifications entirely. Important dates are always shown (no per-date privacy flag for simplicity).
- **Notification type**: Use `"system"` notification type with `entity_type="client"` so RM can click through to client profile.
- **Dashboard widget**: Uses `useUpcomingDates(14)` (14-day lookahead). Only shown to internal users.
- **RMs see only their clients**: The `GET /clients/upcoming-dates` endpoint filters by `assigned_rm_id` = current user when role is RM.

---

## Acceptance Criteria Mapping

| Requirement | Implementation |
|-------------|---------------|
| RMs receive birthday reminders | Scheduler daily job → notification_service |
| Important dates can be added/edited | `ImportantDatesForm` + PATCH endpoint |
| Dashboard shows upcoming dates | `UpcomingDatesWidget` on dashboard page |
| Works with scheduler service | `_check_client_dates_job` in scheduler |
| Respects privacy settings | `birthday_reminders_enabled` field |

---

## Risks

- Year boundary in date matching: Must handle Dec → Jan wrap-around (e.g., checking dates within 7 days of Dec 30 should include Jan 1).
- Notification deduplication: Keep it simple — check if a notification with title starting with the same prefix was created today for the same user.
- The migration `down_revision` must be the actual latest revision ID. Current latest appears to be `add_predicted_risks`. Verify before running.
