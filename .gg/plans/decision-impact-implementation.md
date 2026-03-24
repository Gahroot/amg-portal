# Decision Impact Explanation — Implementation Plan

## Exploration Summary

- **Model**: `backend/app/models/decision_request.py` — `options` stored as JSON column, no migration needed
- **Schema**: `backend/app/schemas/decision_request.py` — `DecisionOption` currently has `id`, `label`, `description`
- **Frontend types**: `frontend/src/types/communication.ts` — `DecisionOption` interface
- **Existing components**: `decision-request-card.tsx`, `decision-response-dialog.tsx`
- **Pages**: portal decisions page and dashboard decisions page both use the dialog

## Changes Already Made

1. ✅ `backend/app/schemas/decision_request.py` — extended `DecisionOption` with `impact_description`, `what_happens_next`, `considerations`, `recommended`
2. ✅ `frontend/src/types/communication.ts` — matching TypeScript fields added
3. ✅ `frontend/src/components/decisions/decision-explanation.tsx` — created (FAQ accordion, context banner, per-option explanations)

## Remaining Work

4. Create `frontend/src/components/decisions/option-comparison.tsx`
5. Update `frontend/src/components/decisions/decision-response-dialog.tsx` to integrate explanation panel + comparison
6. Run linting/typechecking

## No DB Migration Required

`options` is a JSON column — new fields are just additional JSON keys stored inline.
