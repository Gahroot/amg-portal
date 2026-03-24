# Preferred Partners Memory — Implementation Plan

## Overview
Implement a "preferred partners" system that learns from partner assignment history and ratings to auto-suggest the best partners when assigning to a program. Preferences are tracked per client + service category + region and can also be set manually.

---

## Architecture

### Data Model
`partner_preferences` table — one row per (client, partner, service_category) combination:
- `client_id` → FK clients.id
- `partner_id` → FK partner_profiles.id  
- `service_category` — string (matches PartnerCapability enum: investment_advisory, tax_planning, etc.)
- `region` — optional string (filters partner geographies)
- `preference_score` — float 0–100, starts at 50 for neutral, auto-adjusted
- `usage_count` — int, how many times this partner was used for this client+category
- `last_used_at` — datetime
- `preference_type` — enum: "preferred" | "neutral" | "avoid"
- `notes` — optional text
- `created_by` / `updated_by` — FK users.id

### Score Dynamics
- Manual "preferred" → score = 80.0
- Manual "avoid" → score = 10.0
- Assignment completed successfully (status=completed, no SLA breach) → +5 (cap 100)
- SLA breach recorded → -10 (floor 10)
- Poor rating (overall_score < 3) → -8
- Good rating (overall_score >= 4) → +5

### Recommendation Algorithm
Query: for a given (client_id, service_category, region_optional):
1. Join partner_preferences + partner_profiles
2. Filter: partner status=active, preference_type != "avoid"
3. Rank by: preference_score DESC, usage_count DESC
4. Augment with: partner's global performance_rating, availability_status
5. Return top 5 with reason string ("Preferred", "Used 3x", "High rated", "New partner")

---

## Files to Create/Modify

### Backend

#### 1. `backend/app/models/partner_preference.py` (NEW)
SQLAlchemy model with UniqueConstraint on (client_id, partner_id, service_category).

#### 2. `backend/app/schemas/partner_preference.py` (NEW)
Pydantic schemas:
- `PartnerPreferenceCreate` — client_id, partner_id, service_category, region, preference_type, notes
- `PartnerPreferenceUpdate` — preference_type, preference_score, notes (all optional)
- `PartnerPreferenceResponse` — all fields + partner info (firm_name, contact_name)
- `PartnerRecommendationItem` — partner_id, firm_name, contact_name, preference_score, usage_count, reason, availability_status, performance_rating
- `PartnerRecommendationsResponse` — items list, total

#### 3. `backend/app/services/partner_preference_service.py` (NEW)
Functions:
- `get_recommendations(db, client_id, service_category, region, limit)` → list[PartnerRecommendationItem]
- `upsert_preference(db, client_id, partner_id, service_category, region, preference_type, notes, created_by)` → PartnerPreference
- `record_completion(db, client_id, partner_id, service_category, success, rating_score)` → PartnerPreference | None
- `adjust_score(preference, delta)` → clamps 10–100

#### 4. `backend/app/api/v1/partner_preferences.py` (NEW)
Endpoints (all require `require_internal`):
- `GET /partner-preferences/recommendations` — query params: client_id, service_category, region, limit
- `GET /clients/{client_id}/partner-preferences` — list all preferences for a client
- `POST /clients/{client_id}/partner-preferences` — create/update a preference (upsert by client+partner+category)
- `PATCH /clients/{client_id}/partner-preferences/{preference_id}` — update preference_type / score / notes
- `DELETE /clients/{client_id}/partner-preferences/{preference_id}` — remove preference (resets to neutral)
- `POST /partner-preferences/record-completion` — body: {client_id, partner_id, service_category, assignment_id, success, rating_score}

#### 5. `backend/alembic/versions/add_partner_preferences.py` (NEW)
Migration creating `partner_preferences` table.

#### 6. `backend/app/models/__init__.py` (MODIFY)
Add `from app.models.partner_preference import PartnerPreference  # noqa: F401`

#### 7. `backend/app/api/v1/router.py` (MODIFY)
Import and register the new router at prefix `/partner-preferences`.

### Frontend

#### 8. `frontend/src/types/partner-preference.ts` (NEW)
TypeScript interfaces mirroring the schemas.

#### 9. `frontend/src/lib/api/partner-preferences.ts` (NEW)
API functions: getRecommendations, listPreferences, upsertPreference, updatePreference, deletePreference, recordCompletion.

#### 10. `frontend/src/hooks/use-partner-preferences.ts` (NEW)
React Query hooks: useRecommendations, useClientPreferences, useUpsertPreference, useDeletePreference, useRecordCompletion.

#### 11. `frontend/src/components/partners/partner-recommendations.tsx` (NEW)
Shows a ranked list of recommended partners for a (client, service_category):
- Props: `clientId: string, serviceCategory: string, region?: string, onSelect?: (partnerId: string) => void`
- Each row: partner avatar-like badge, firm_name, reason pill ("⭐ Preferred", "✓ Used 3×", "★ High rated", "New")
- availability badge (green/amber/red)
- preference_score as small gauge
- "Set as Preferred" / "Mark Avoid" quick-action buttons
- Loading skeleton, empty state "No preference data yet — assign partners to build history"

#### 12. `frontend/src/components/partners/preference-manager.tsx` (NEW)
Management UI for viewing/editing all preferences for a client:
- Props: `clientId: string`
- Table: partner name | service category | region | status badge | score | usage | last used | actions
- Actions: "Set Preferred" (star), "Set Avoid" (ban), "Reset" (x), "Edit notes"
- Filter tabs: All | Preferred | Avoid
- Empty state if no preferences yet
- Uses `useClientPreferences` hook

---

## Implementation Order

1. Backend model + migration
2. Backend schemas
3. Backend service  
4. Backend API endpoints
5. Register in router + models __init__
6. Frontend types
7. Frontend API functions
8. Frontend hooks
9. Frontend PartnerRecommendations component
10. Frontend PreferenceManager component
11. Lint + typecheck

---

## Scoring Logic Detail

```python
SCORE_ADJUSTMENTS = {
    "completion_success": +5.0,
    "sla_breach": -10.0,
    "good_rating": +5.0,   # overall_score >= 4
    "poor_rating": -8.0,   # overall_score < 3
}

MANUAL_SCORES = {
    "preferred": 80.0,
    "avoid": 10.0,
}
```

When `upsert_preference` is called with `preference_type="preferred"`, score is immediately set to 80. When `record_completion` is called, only the delta is applied (not overwriting manual settings unless they want to).

## Recommendation Reason Logic

```python
def compute_reason(pref, partner):
    if pref.preference_type == "preferred":
        return "Preferred"
    elif pref.usage_count >= 3:
        return f"Used {pref.usage_count}×"
    elif partner.performance_rating and partner.performance_rating >= 4:
        return "High rated"
    elif pref.usage_count == 0:
        return "Suggested"
    else:
        return f"Used {pref.usage_count}×"
```

Partners with no preference record yet can appear in recommendations if they match the service_category via `partner_profiles.capabilities` JSON array — they get a default score of 50 and reason "Suggested".

---

## Key API Shapes

### GET /api/v1/partner-preferences/recommendations
Query: `?client_id=<uuid>&service_category=<str>&region=<str>&limit=5`

Response:
```json
{
  "items": [
    {
      "partner_id": "...",
      "firm_name": "Smith & Partners",
      "contact_name": "John Smith",
      "preference_score": 85.0,
      "usage_count": 4,
      "reason": "Used 4×",
      "availability_status": "available",
      "performance_rating": 4.2,
      "preference_type": "neutral",
      "preference_id": "..." | null
    }
  ],
  "total": 5
}
```

### POST /api/v1/clients/{client_id}/partner-preferences
Body:
```json
{
  "partner_id": "...",
  "service_category": "tax_planning",
  "region": "EMEA",
  "preference_type": "preferred",
  "notes": "Great attention to detail"
}
```

### POST /api/v1/partner-preferences/record-completion
Body:
```json
{
  "client_id": "...",
  "partner_id": "...",
  "service_category": "tax_planning",
  "assignment_id": "...",
  "success": true,
  "rating_score": 5
}
```
