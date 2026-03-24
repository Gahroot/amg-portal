# Partner Performance Governance — Implementation Plan

## Overview
Add SLA adherence tracking, first-pass approval rates, probationary period monitoring, improvement reviews, and de-listing workflows across 14 files.

## Phases

### Phase 1: Model Changes
- `backend/app/models/partner.py` — Add 6 governance columns (is_probationary, probation_engagements_remaining, governance_status, improvement_review_started_at, below_threshold_count, last_below_threshold_at)
- `backend/app/models/enums.py` — Add GovernanceStatus enum
- `backend/alembic/versions/add_partner_governance_fields.py` — Migration (down_revision=24f7329b0cc1)

### Phase 2: Schemas
- `backend/app/schemas/partner_governance.py` — GovernanceStatusResponse, DelistRequest, GovernanceAlertItem, GovernanceAlertsResponse
- `backend/app/schemas/dashboard.py` — Extend PartnerScorecard with governance+metric fields

### Phase 3: Scoring Service
- `backend/app/services/partner_scoring_service.py` — Add calculate_sla_adherence, calculate_first_pass_rate, calculate_task_completion_rate, calculate_avg_acceptance_time; update get_partner_scorecard

### Phase 4: Governance Service
- `backend/app/services/partner_governance_service.py` — check_probation_status, evaluate_performance_threshold, delist_partner, reinstate_partner, get_governance_alerts

### Phase 5: API Endpoints
- `backend/app/api/v1/partner_scoring.py` — 6 new endpoints (governance, evaluate, delist, reinstate, alerts, CSV export)
- `backend/app/services/closure_service.py` — Auto-trigger governance after rating

### Phase 6: Frontend API & Hooks
- `frontend/src/lib/api/partner-scoring.ts` — API functions + types
- `frontend/src/hooks/use-partner-governance.ts` — TanStack Query hooks

### Phase 7: Frontend Components
- `frontend/src/components/partners/governance-status-card.tsx` — Status card with metrics and MD actions
- `frontend/src/app/(dashboard)/analytics/partner-performance/page.tsx` — Add alerts banner + governance section
- `frontend/src/lib/api/dashboard.ts` — Extend PartnerScorecard type

### Phase 8: Verification
- `cd backend && ruff check . && mypy .`
- `cd frontend && npm run lint && npm run typecheck`
