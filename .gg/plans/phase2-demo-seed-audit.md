# Phase 2 Demo Seed — Comprehensive Audit

## What Phase 2 Actually Is

Per the scope doc, Phase 2 ("Client Platform Core") has four deliverables:
1. **Document delivery system** (reports, briefs, plans, contracts)
2. **Secure messaging** (client ↔ AMG ↔ partners)
3. **Scheduling and coordination tools**
4. **Evidence vault** (due diligence artifacts, security assessments)

## What Already Exists (Backend + Frontend)

### ✅ Fully built — just needs data

| Feature | Backend API | Frontend Page | Models |
|---|---|---|---|
| **Document delivery** | `client_portal.py` — `/portal/documents`, download, share, acknowledge | `(portal)/portal/documents/page.tsx` + requests, shared, signing sub-pages | `Document`, `DocumentShare`, `DocumentAcknowledgment`, `DocumentDelivery` |
| **Secure messaging** | `conversations.py`, `communications.py`, `client_portal.py`, `partner_portal.py` | `(portal)/portal/messages/page.tsx` (full split-pane UI), `(partner)/partner/messages/` | `Conversation`, `Communication` |
| **Scheduling** | `meetings.py`, `scheduling.py`, `calendar.py`, `calendar_feed.py` | `(portal)/portal/schedule/page.tsx` (book meeting + my meetings), `(dashboard)/scheduling/page.tsx` | `Meeting`, `RMAvailability`, `ScheduledEvent`, `MeetingType` |
| **Evidence vault** | `documents.py` — vault endpoints, seal/unseal | `(dashboard)/documents/vault/page.tsx` | `Document.vault_status`, `chain_of_custody` |
| **Admin dashboard** | `dashboard.py` — portfolio summary, program health, at-risk, stats, alerts, activity | `(dashboard)/page.tsx` — full dashboard with widgets | All core models |
| **Client portal dashboard** | `client_portal.py` — profile, programs, milestones, docs, decisions | `(portal)/portal/dashboard/page.tsx` — programs, progress, decisions, comms | `ClientProfile`, `Program`, `Milestone`, `DecisionRequest` |
| **Partner portal dashboard** | `partner_portal.py` — profile, assignments, deliverables, scorecard | `(partner)/partner/page.tsx` — assignments, deliverables, trends, performance | `PartnerProfile`, `PartnerAssignment`, `Deliverable` |
| **Document requests** | `document_requests.py`, `client_portal.py` | `(portal)/portal/documents/requests/` | `DocumentRequest` |
| **Decision requests** | `decision_requests.py`, `client_portal.py` | `(portal)/portal/decisions/` | `DecisionRequest` |
| **Partner deliverables** | `partner_portal.py` — submit, bulk-submit | `(partner)/partner/deliverables/` + upload sub-page | `Deliverable` |
| **Programs management** | `programs.py` — full CRUD with milestones, tasks | `(dashboard)/programs/` | `Program`, `Milestone`, `Task` |
| **Client management** | `clients.py`, `intake.py` — profiles + intake workflow | `(dashboard)/clients/` | `Client`, `ClientProfile` |
| **Partners management** | `partners.py` — full CRUD | `(dashboard)/partners/` | `PartnerProfile` |

### Summary: The features are built. There is zero seed data.

---

## What the Seed Script Must Create

### 1. Users (6 accounts — one per role)

| Role | Demo Email | Purpose |
|---|---|---|
| `managing_director` | `md@amg-demo.com` | Admin portal — full access |
| `relationship_manager` | `rm@amg-demo.com` | Admin portal — RM view, owns clients |
| `coordinator` | `coord@amg-demo.com` | Admin portal — dispatches partners |
| `finance_compliance` | `compliance@amg-demo.com` | Admin portal — compliance review |
| `client` | `client@amg-demo.com` | Client portal (`/portal/dashboard`) |
| `partner` | `partner@amg-demo.com` | Partner portal (`/partner`) |

All with password `DemoPass123!`, status `active`, `mfa_enabled=False` (so MFA grace period applies and they get real tokens).

**⚠️ MFA Blocker**: The login flow issues `mfa_setup_required=True` when `mfa_enabled=False`. Within the grace period (7 days from creation), it issues real tokens BUT the frontend throws `MFASetupRequiredError` and redirects to `/mfa-setup`. 

**Options to unblock demo:**
- **Option A (recommended)**: Set `mfa_enabled=True` and provide a known `mfa_secret` + backup codes on seeded users. Then use a TOTP app or backup code to log in.
- **Option B**: Set `mfa_enabled=True` with `mfa_secret=None` and patch the login endpoint to skip MFA verification when secret is null (hacky).
- **Option C**: Add a `DEMO_MODE=true` env flag that skips MFA entirely in the login flow.
- **Option D**: The auth provider already handles grace period — the redirect to `/mfa-setup` can simply be dismissed/completed. But this adds friction to every demo login.

### 2. Client Profiles (2-3 profiles)

The `Client` table is the lightweight FK anchor. `ClientProfile` is the rich profile. Both need rows.

| Client | Type | RM | Status |
|---|---|---|---|
| "Harrington Family Office" | `family_office` | RM user | `active` |
| "Marcus Chen" | `uhnw_individual` | RM user | `active` |
| "GlobalExec Capital" | `global_executive` | RM user | `active` |

Each needs:
- `Client` row (name, type, rm_id)
- `ClientProfile` row (legal_name, primary_email, compliance_status=`cleared`, approval_status=`approved`, user_id=client user for the first one, created_by=RM)
- The `client` role user's `client_profile.user_id` must point to user so the portal can find them

### 3. Programs (3-4 programs across clients)

| Program | Client | Status | Budget |
|---|---|---|---|
| "Executive Protection — Dubai Summit" | Harrington | `active` | $250,000 |
| "Estate Planning 2026" | Harrington | `design` | $150,000 |
| "Global Relocation Advisory" | Marcus Chen | `active` | $500,000 |
| "Art Collection Insurance Review" | GlobalExec | `intake` | $75,000 |

Each needs `created_by` = RM user.

### 4. Milestones & Tasks (2-3 per program)

For the active programs, create milestones with realistic tasks:

Example for "Executive Protection — Dubai Summit":
- Milestone: "Threat Assessment" — `completed`, with 3 tasks (all `done`)
- Milestone: "Protocol Development" — `in_progress`, with 3 tasks (1 `done`, 1 `in_progress`, 1 `todo`)
- Milestone: "Deployment Planning" — `pending`, with 2 tasks (all `todo`)

### 5. Partner Profile (1-2 partners)

| Partner | Firm | Capabilities | Status |
|---|---|---|---|
| Partner user | "Sentinel Security Group" | `[security, concierge]` | `active` |
| (no user) | "Whitfield Legal" | `[legal, estate_planning]` | `active` |

The `partner` role user needs `PartnerProfile.user_id` pointing to them.

### 6. Partner Assignments (2-3)

| Assignment | Program | Partner | Status |
|---|---|---|---|
| "Dubai Advance Team Deployment" | Dubai Summit | Sentinel | `in_progress` |
| "Estate Document Review" | Estate Planning | Whitfield Legal | `dispatched` |
| "Relocation Legal Compliance" | Global Relocation | Sentinel | `accepted` |

### 7. Deliverables (2-3)

| Deliverable | Assignment | Status |
|---|---|---|
| "Threat Assessment Report" | Dubai Advance Team | `submitted` |
| "Advance Route Survey" | Dubai Advance Team | `pending` |
| "Estate Document Checklist" | Estate Doc Review | `pending` |

### 8. Documents (4-6)

No actual files needed — just DB rows with `file_path` pointing to dummy paths. The UI shows metadata and download buttons (which will 404, fine for demo).

| Document | Entity | Category |
|---|---|---|
| "Q1 2026 Portfolio Report.pdf" | client: Harrington | `report` |
| "Dubai Summit Brief.pdf" | program: Dubai Summit | `general` |
| "NDA — Sentinel Security.pdf" | partner: Sentinel | `contract` |
| "Due Diligence — Harrington.pdf" | client: Harrington | `compliance`, `vault_status=sealed` |

### 9. Conversations & Messages (2-3 threads)

| Conversation | Type | Participants |
|---|---|---|
| "Program Update — Dubai Summit" | `rm_client` | RM + Client user, linked to Harrington profile |
| "Deployment Timeline Discussion" | `coordinator_partner` | Coordinator + Partner user, linked to assignment |

Each with 3-5 `Communication` messages back and forth.

### 10. Decision Requests (1-2)

| Decision | Client | Program | Status |
|---|---|---|---|
| "Approve Dubai Venue Selection" | Harrington profile | Dubai Summit | `pending` |
| "Estate Plan Option Selection" | Harrington profile | Estate Planning | `pending` |

### 11. Notifications (5-10)

Seed a few notifications for each user so the notification bell shows data.

### 12. Escalations (1-2)

At least one open escalation to populate the dashboard alerts panel.

### 13. Scheduled Events / Meetings (2-3)

Future-dated meetings so the scheduling and calendar pages have data.

---

## Implementation Plan

### Step 1: Create `backend/scripts/seed_demo.py`

A standalone async script that:
1. Connects to the DB using the existing `AsyncSessionLocal`
2. Checks if seed data already exists (idempotent — skip if `md@amg-demo.com` exists)
3. Creates all entities in dependency order:
   - Users → Clients + ClientProfiles → Programs → Milestones → Tasks
   - Partner Profiles → Assignments → Deliverables
   - Documents, Conversations + Communications, Decision Requests
   - Notifications, Escalations, Scheduled Events
4. Commits in a single transaction

### Step 2: Handle the MFA Demo Blocker

**Recommended: Option C — add `DEMO_MODE` flag**

In `backend/app/core/config.py`:
```python
DEMO_MODE: bool = False  # Skip MFA enforcement for demo/dev
```

In `backend/app/api/v1/auth.py` login endpoint, after password verification:
```python
if settings.DEMO_MODE and not user.mfa_enabled:
    # Skip MFA entirely in demo mode
    user.last_login_at = datetime.now(UTC)
    await db.commit()
    token_data = {"sub": str(user.id), "email": user.email}
    return Token(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )
```

### Step 3: Add a convenience command

Add to `backend/pyproject.toml` or just document:
```bash
# Seed demo data
cd backend && python -m scripts.seed_demo

# Or via the existing alembic pattern:
cd backend && alembic upgrade head && python -m scripts.seed_demo
```

### Step 4: Verify all three portals render

After seeding, verify:
1. **Admin** (`/`): Login as `md@amg-demo.com` → Dashboard shows stats, programs, alerts
2. **Client** (`/portal/dashboard`): Login as `client@amg-demo.com` → Programs, documents, messages, decisions
3. **Partner** (`/partner`): Login as `partner@amg-demo.com` → Assignments, deliverables, messages

---

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| MFA blocks all logins | **HIGH** | Must implement Option C (DEMO_MODE) or Option A |
| Missing DB migrations | Medium | Run `alembic upgrade head` first — migrations exist for all models |
| Frontend API calls fail on empty data | Low | Most hooks use `useQuery` with loading states — empty is fine, but the demo looks hollow |
| Document download URLs 404 | Low | Expected — seed script can note "demo data" in descriptions |
| RLS policies block queries | Medium | Seed script must create data with correct ownership (rm_id, user_id relationships) |
| `ClientProfile.user_id` not linked to client user | **HIGH** | Client portal uses `user_id` to find the profile — must be correctly linked |

---

## Files to Create/Modify

| File | Action | Purpose |
|---|---|---|
| `backend/scripts/__init__.py` | Create | Package init |
| `backend/scripts/seed_demo.py` | Create | Main seed script (~300-400 lines) |
| `backend/app/core/config.py` | Edit | Add `DEMO_MODE: bool = False` |
| `backend/app/api/v1/auth.py` | Edit | Skip MFA when `DEMO_MODE=True` |
| `backend/.env` | Edit | Add `DEMO_MODE=true` |

## Estimated Effort

~2-3 hours for a thorough implementation with realistic demo data across all three portals.
