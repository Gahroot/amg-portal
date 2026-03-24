# Partner Leaderboard / Gamification — Implementation Plan

## Overview
Add an optional, privacy-first leaderboard and achievement badge system for the partner portal.
Partners opt in to be visible on the leaderboard. Their individual stats remain private regardless.
The leaderboard computes rankings from existing scoring data (partner_ratings, sla_trackers, partner_assignments).

---

## Architecture Decisions

### No New DB Tables Needed for Rankings
Rankings are computed on-the-fly from existing data (`partner_ratings`, `sla_tracker`, `partner_assignments`). No denormalized leaderboard snapshots required.

### New DB Tables
1. **`partner_leaderboard_settings`** — per-partner opt-in preference + display name preference.
2. **`partner_achievements`** — badge awards per partner (Top Performer, SLA Compliance, Streak, etc.).

### Badge Logic
Badges are computed at query time by the service (no periodic batch job needed).
The service checks conditions and upserts achievements on each fetch.

### Privacy
- `leaderboard_opted_in = False` by default — partner only appears after opting in.
- `show_firm_name = True` by default when opted in (can choose to be anonymous).
- Own rank is always returned (even if not opted in) so partner sees where they'd rank.
- Leaderboard list only shows opted-in partners.

### Periods
- `all_time` — based on all historical ratings and SLA data.
- `monthly` — current calendar month.
- `weekly` — current ISO week.

### Categories
- `overall` — composite score (60% rating + 40% SLA).
- Per service type not needed for MVP (no reliable per-assignment service_type in current data).

---

## Files to Create / Modify

### Backend
| File | Action |
|---|---|
| `backend/app/models/partner_leaderboard.py` | **new** — PartnerLeaderboardSettings + PartnerAchievement |
| `backend/app/schemas/partner_leaderboard.py` | **new** — Pydantic schemas |
| `backend/app/services/partner_leaderboard_service.py` | **new** — service |
| `backend/app/api/v1/partner_leaderboard.py` | **new** — API routes |
| `backend/app/models/__init__.py` | **modify** — register new models |
| `backend/app/api/v1/router.py` | **modify** — include new router |
| `backend/alembic/versions/add_partner_leaderboard.py` | **new** — migration |

### Frontend
| File | Action |
|---|---|
| `frontend/src/lib/api/partner-leaderboard.ts` | **new** — typed API client |
| `frontend/src/components/partner/leaderboard-widget.tsx` | **new** — full leaderboard + badges component |
| `frontend/src/app/(partner)/partner/leaderboard/page.tsx` | **new** — page |
| `frontend/src/config/partner-nav.ts` | **modify** — add Leaderboard nav item |

---

## Step-by-Step Implementation

### Step 1 — ORM Models

```python
# backend/app/models/partner_leaderboard.py

class PartnerLeaderboardSettings(Base, TimestampMixin):
    __tablename__ = "partner_leaderboard_settings"
    id: UUID primary_key default uuid4
    partner_id: FK partner_profiles.id UNIQUE NOT NULL index
    leaderboard_opted_in: bool default False
    show_firm_name: bool default True  # if False, shown as "Partner #N"
    display_name: str nullable  # optional custom alias

class PartnerAchievement(Base, TimestampMixin):
    __tablename__ = "partner_achievements"
    id: UUID primary_key default uuid4
    partner_id: FK partner_profiles.id NOT NULL index
    badge_key: str NOT NULL  # top_performer | sla_hero | streak_5 | prolific | rising_star
    label: str NOT NULL
    description: str NOT NULL
    earned_at: datetime NOT NULL
    UniqueConstraint(partner_id, badge_key)
```

Badge keys and their conditions:
- `top_performer` — composite_score >= 80
- `sla_hero` — sla_compliance_rate == 100.0
- `prolific` — total_completed_assignments >= 10
- `rising_star` — total_completed_assignments >= 3 (first steps)
- `streak_5` — 5 or more consecutive completed assignments (no cancellations in between)

### Step 2 — Pydantic Schemas

```python
# backend/app/schemas/partner_leaderboard.py

class LeaderboardEntry(BaseModel):
    rank: int
    display_name: str  # "Firm Name" or "Partner #N"
    composite_score: float | None
    total_completed: int
    sla_compliance_rate: float | None
    is_self: bool  # True if this entry is the requesting partner

class LeaderboardResponse(BaseModel):
    period: str  # all_time | monthly | weekly
    entries: list[LeaderboardEntry]
    total_participants: int
    my_rank: int | None  # rank in opted-in pool; None if no data
    my_score: float | None
    opted_in: bool

class AchievementResponse(BaseModel):
    badge_key: str
    label: str
    description: str
    earned_at: datetime

class LeaderboardSettingsResponse(BaseModel):
    leaderboard_opted_in: bool
    show_firm_name: bool
    display_name: str | None

class LeaderboardSettingsUpdate(BaseModel):
    leaderboard_opted_in: bool | None = None
    show_firm_name: bool | None = None
    display_name: str | None = None
```

### Step 3 — Service Methods

```python
# backend/app/services/partner_leaderboard_service.py

async def get_or_create_settings(db, partner_id) -> PartnerLeaderboardSettings
    # SELECT or INSERT with defaults

async def update_settings(db, partner_id, update_data) -> PartnerLeaderboardSettings
    # UPSERT settings

async def get_leaderboard(db, partner_id, period) -> LeaderboardResponse:
    # 1. Get all opted-in partners
    # 2. For each, compute composite_score (reuse calculate_composite_score)
    # 3. Sort by composite_score desc
    # 4. Also compute my own score (regardless of opt-in)
    # 5. Determine my rank in the opted-in pool
    # 6. Return with is_self flag

    # Period filter: use date ranges on PartnerRating.created_at for monthly/weekly

async def get_achievements(db, partner_id) -> list[AchievementResponse]:
    # 1. Compute composite score
    # 2. Check each badge condition
    # 3. Upsert earned badges
    # 4. Return current badges

async def _compute_period_score(db, partner_id, period) -> dict:
    # Like calculate_composite_score but filtered by period date range
```

Key SQL patterns (period-filtered):
- Monthly ratings: `WHERE created_at >= date_trunc('month', now())`
- Weekly: `WHERE created_at >= date_trunc('week', now())`
- All-time: no date filter

### Step 4 — API Routes

All under `/partner-portal` prefix (existing router), new file imported in router.py.

```
GET  /partner-portal/leaderboard              → LeaderboardResponse  (partner auth)
GET  /partner-portal/leaderboard/settings     → LeaderboardSettingsResponse
PATCH /partner-portal/leaderboard/settings    → LeaderboardSettingsResponse
GET  /partner-portal/leaderboard/achievements → list[AchievementResponse]
```

### Step 5 — Migration

```python
# backend/alembic/versions/add_partner_leaderboard.py
# Revises: add_escalation_playbooks (latest head)

# Creates:
# - partner_leaderboard_settings
# - partner_achievements
# - Indexes on partner_id for both
# - UniqueConstraint on (partner_id, badge_key) for achievements
```

### Step 6 — Frontend API Client

```typescript
// frontend/src/lib/api/partner-leaderboard.ts

export interface LeaderboardEntry { ... }
export interface LeaderboardResponse { ... }
export interface AchievementResponse { ... }
export interface LeaderboardSettings { ... }
export interface LeaderboardSettingsUpdate { ... }

export async function getLeaderboard(period?: string): Promise<LeaderboardResponse>
export async function getLeaderboardSettings(): Promise<LeaderboardSettings>
export async function updateLeaderboardSettings(data: LeaderboardSettingsUpdate): Promise<LeaderboardSettings>
export async function getMyAchievements(): Promise<AchievementResponse[]>
```

### Step 7 — Leaderboard Widget Component

`frontend/src/components/partner/leaderboard-widget.tsx`

Sections:
1. **Opt-in Banner** — if `!opted_in`, prominent CTA to join leaderboard. Privacy notice.
2. **My Position Card** — my rank, score, even if not opted in (shows "your rank if you join").
3. **Achievements Section** — badges displayed as icons with labels.
4. **Leaderboard Table** — rank, display_name (truncated if anonymous), score, SLA%, completed.
   - Own row highlighted with `bg-primary/5` and bold text.
5. **Settings Modal** — opt in/out toggle, show_firm_name toggle, display_name input.

Period selector: tabs for Weekly / Monthly / All Time.

### Step 8 — Leaderboard Page

`frontend/src/app/(partner)/partner/leaderboard/page.tsx`
- Simple wrapper that renders `<LeaderboardWidget />`
- Uses `useQuery` for data fetching

### Step 9 — Nav Item

Add between "Reports" and "Settings" in `partnerNavConfig`:
```ts
{
  title: "Leaderboard",
  href: "/partner/leaderboard",
  icon: Trophy,
  tooltip: "Performance Leaderboard",
}
```

---

## Routing Summary

| Route | Auth | Tag |
|---|---|---|
| `GET /api/v1/partner-portal/leaderboard` | partner | partner-leaderboard |
| `GET /api/v1/partner-portal/leaderboard/settings` | partner | partner-leaderboard |
| `PATCH /api/v1/partner-portal/leaderboard/settings` | partner | partner-leaderboard |
| `GET /api/v1/partner-portal/leaderboard/achievements` | partner | partner-leaderboard |

---

## Quality Checks

```bash
cd backend && ruff check . && mypy .
cd frontend && npm run lint && npm run typecheck
```
