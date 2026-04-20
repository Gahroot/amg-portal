# Plan: Batch-fetch `get_governance_dashboard` queries

## Problem Analysis

`get_governance_dashboard` (lines 347–412) currently loops over up to 50 partners and for each one issues:

1. **`calculate_composite_score`** (called via the per-partner `score_data = await calculate_composite_score(db, pid)` call), which itself issues:
   - Query 1: `SELECT PartnerProfile WHERE id = partner_id`  
   - Query 2: `SELECT avg(…) FROM partner_ratings WHERE partner_id = …` (inside `calculate_partner_score`)
   - Query 3: `SELECT count, breached FROM sla_trackers WHERE assigned_to = partner.user_id` (SLA component)
   - Query 4: `SELECT PartnerGovernance … LIMIT 1` (inside `get_current_governance_status`)
2. **`latest_gov`**: another `SELECT PartnerGovernance … LIMIT 1` (duplicate of query 4 above, retrieving full object for `.action` and `.effective_date`)
3. **`sla_breach_count`**: `SELECT count FROM sla_trackers WHERE … = "breached"` (redundant subset of query 3)
4. **`notice_count`**: `SELECT count FROM performance_notices WHERE partner_id = …`

That's up to **7 queries × 50 partners = 350 round-trips** (some saved when `user_id` is null, but worst-case is 350).

The partner objects are already fetched up-front; the loop re-fetches them redundantly inside `calculate_composite_score`.

## Approach

Replace the loop with **6 batch queries** that cover all partners:

1. **Count query** – already batch: `SELECT count(PartnerProfile.id)` ✓
2. **Partners page** – already batch: `SELECT PartnerProfile … LIMIT N` ✓
3. **Ratings aggregates** – `SELECT partner_id, avg(quality), avg(timeliness), avg(communication), avg(overall), count(*) FROM partner_ratings WHERE partner_id IN (…) GROUP BY partner_id`
4. **SLA aggregates** – `SELECT assigned_to, count(*) AS total, count(CASE WHEN breach_status='breached') AS breached FROM sla_trackers WHERE assigned_to IN (…) GROUP BY assigned_to` — keyed by `user_id`
5. **Latest governance per partner** – use a window function or a lateral/subquery to get the most-recent non-expired governance row per partner: `SELECT DISTINCT ON (partner_id) * FROM partner_governance WHERE partner_id IN (…) AND (expiry_date IS NULL OR expiry_date > now()) ORDER BY partner_id, created_at DESC`
6. **Notice counts** – `SELECT partner_id, count(*) FROM performance_notices WHERE partner_id IN (…) GROUP BY partner_id`

Then compute scores in-memory by building lookup dicts keyed by `partner_id` (or `user_id` for SLA), and call the pure `evaluate_recommended_action` function.

The existing `calculate_composite_score`, `get_current_governance_status`, and `calculate_partner_score` single-partner functions are **not changed** — they remain for individual-partner use. Only `get_governance_dashboard` is refactored.

## Key Details

- `PartnerProfile.user_id` links to `SLATracker.assigned_to`. Some partners may have `user_id = None`; skip them for SLA queries (as the existing code does).
- Window function `DISTINCT ON` is PostgreSQL-specific and valid here (project uses PostgreSQL 17).
- For governance status used in `evaluate_recommended_action`: if the latest non-expired governance row exists, its `action` is the status; otherwise `"good_standing"`.
- The dashboard entry's `current_action` comes from the latest governance row regardless of expiry (the existing code fetches without an expiry filter for the dashboard, only `get_current_governance_status` filters by expiry). The refactored code must preserve both semantics:
  - `current_action` / `current_action_date` → latest governance row ordered by `created_at DESC`, **no** expiry filter
  - `current_governance_status` (for `evaluate_recommended_action`) → latest non-expired governance row
  - These may differ; we need **two** governance batch queries, or one query fetching all rows and picking appropriately in Python. Using one query with all latest governance rows (no expiry filter) and computing the status in-memory is cleanest.

  Actually, re-reading the existing loop: the `gov_result` query (lines 370–376) has **no expiry filter** (gets latest action for display), while `get_current_governance_status` (called inside `calculate_composite_score`) **does** filter by expiry. So we need both the latest overall governance and the latest non-expired governance per partner.

  **Solution**: Fetch two batch queries:
  - **5a.** Latest governance row per partner (no expiry filter) → for `current_action` / `current_action_date`
  - **5b.** Latest non-expired governance row per partner → for `current_governance_status` used in `evaluate_recommended_action`

  Or alternatively, fetch all governance rows for the page of partners and process in Python (simple, avoids complex window functions). With 50 partners, governance rows are bounded and this is safe.

  **Chosen approach**: One batch query fetching all governance rows for the partner set, then in-memory compute both the latest-overall and latest-non-expired per partner. This is simpler and avoids two window-function queries.

## Files Changed

- `backend/app/services/partner_scoring_service.py` — only `get_governance_dashboard` is rewritten

## Steps

1. Read `backend/app/services/partner_scoring_service.py` to confirm current content
2. Rewrite `get_governance_dashboard` to:
   a. Fetch count + partners page (2 queries, already correct)
   b. Build `partner_ids` list and `user_ids` list from fetched partners
   c. Batch-fetch rating aggregates with `IN (partner_ids)` + GROUP BY
   d. Batch-fetch SLA aggregates with `IN (user_ids)` + GROUP BY (only for non-null user_ids)
   e. Batch-fetch all governance rows for `partner_ids` (ordered by `created_at DESC`)
   f. Batch-fetch notice counts with `IN (partner_ids)` + GROUP BY
   g. Build lookup dicts: `rating_by_pid`, `sla_by_uid`, `gov_rows_by_pid`, `notice_by_pid`
   h. In-memory loop: compute composite score, governance status, recommended action, and build each dashboard entry
3. Run `cd backend && ruff check . && mypy .` and fix any issues
