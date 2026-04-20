# AMG Portal — Performance Optimization Audit

> **Philosophy: N64 mode.** Every cycle counts. We find the stuff that actually murders users and fix it — not the stuff that looks bad in a profiler but nobody notices.

---

## What We Found (The Murder Suspects)

### 🔴 P0 — Kill These First (High-traffic, guaranteed pain)

#### 1. Global Search: Sequential DB queries → Parallel execution
**File:** `backend/app/services/global_search_service.py` (line 248-283)

The `search()` method runs **5 separate sequential DB queries** — programs, clients, partners, documents, tasks — all `await`ed one after another. Every search call blocks for `5 × avg_query_time`. With `LIKE '%term%'` scans on text columns (no `pg_trgm` or `to_tsvector` index), each query is already slow.

**Fix:** `asyncio.gather()` all 5 entity searches in parallel. Trivial change, ~5x throughput improvement for the most user-facing feature (command palette fires on every keystroke).

---

#### 2. Search: `func.lower(...).like()` on unindexed columns → Add `pg_trgm` indexes or use `ilike`
**Files:** `backend/app/services/global_search_service.py`, `backend/app/api/v1/search.py`

`func.lower(Program.title).like(f"%{term}%")` is a full sequential scan every time. Same for clients, partners, documents, tasks. No trigram indexes exist in any migration.

`search_suggestions()` in `search.py` runs **8 separate queries** (prefix + contains × 4 entity types) also sequentially.

**Fix:**
1. Add `pg_trgm` extension + `gin` indexes on `programs.title`, `clients.name`, `partner_profiles.firm_name`, `documents.file_name`, `tasks.title` via a new Alembic migration.
2. Switch `func.lower(col).like(f"%{term}%")` → `col.ilike(f"%{term}%")` to use `ilike` which Postgres can use trgm indexes on.
3. Parallelize the 8 suggestion queries with `asyncio.gather()`.

---

#### 3. Dashboard: `_build_program_health_items()` called TWICE per page load
**File:** `backend/app/api/v1/dashboard.py` (lines 36-115, 237-248)

Both `/program-health` and `/at-risk-programs` call `_build_program_health_items()` independently. The dashboard page (`page.tsx`) calls **both** `useAtRiskPrograms()` and `useProgramHealth()` hooks on mount. That's 2 full table scans (programs + milestones + escalations + SLA) happening simultaneously on every dashboard visit.

`/at-risk-programs` should reuse the `/program-health` data client-side (filter in JS) rather than hitting the DB twice.

**Fix:** Remove the `/at-risk-programs` backend endpoint. In the frontend `useAtRiskPrograms()` hook, derive at-risk from the cached `useProgramHealth()` result instead of making a separate API call.

---

#### 4. `get_portfolio_summary()` loads ALL programs twice
**File:** `backend/app/api/v1/dashboard.py` (lines 140-229)

First query: `select(Program.status, func.count(...))` — fine, aggregate.
Second query (lines 174-181): `select(Program).options(selectinload(Program.milestones))` — loads **every single program with all its milestones**, just to compute RAG status in Python. This is the N+1 problem in disguise — if you have 200 programs with 10 milestones each = 2001 row objects loaded into memory.

**Fix:** Compute RAG status in SQL using a subquery/aggregation:
```sql
SELECT program_id,
  COUNT(*) FILTER (WHERE status='completed') AS completed,
  COUNT(*) AS total,
  MAX(CASE WHEN due_date < NOW() AND status != 'completed' THEN 1 ELSE 0 END) AS has_overdue
FROM milestones GROUP BY program_id
```
Derive red/amber/green from these counts in Python with zero ORM loading.

---

#### 5. Activity Feed: 3 separate queries fetched, merged in Python, then re-paginated
**File:** `backend/app/services/dashboard_aggregation_service.py` (lines 134-218)

`get_activity_feed()` runs 3 separate queries each fetching `limit` rows, then Python sorts and slices. If `limit=50`, you fetch up to 150 rows then throw 100 away. No true pagination possible.

**Fix:** Use a SQL `UNION ALL` query across the 3 sources with a single `ORDER BY created_at DESC LIMIT :limit OFFSET :skip`. One round-trip instead of three, proper pagination. Cache TTL is already 30s so this only needs to be fast on cache miss.

---

### 🟠 P1 — High Leverage, Fix Next

#### 6. Polling tsunami: 6+ intervals all firing independently
**Files:** `frontend/src/hooks/use-notifications.ts`, `use-dashboard.ts`, `use-conversations.ts`, `use-clients.ts`, `use-decisions.ts`, `use-sla.ts`

Tally of active `refetchInterval` timers on the dashboard page:
- `useRealTimeStats` — 30s
- `useActivityFeed` — 30s  
- `useDashboardAlerts` — 30s
- `useNotifications` — 30s
- `useGroupedNotifications` — 30s
- `useUnreadNotificationCount` — 30s
- `useSnoozedNotifications` — 60s
- `useConversations` (message list) — 5s 🔥
- `useDecisions` — 30s
- `useSla` — 60s

The WebSocket is **already connected and invalidating queries on push events**. The polls are essentially redundant fallback — but they're all running simultaneously. 10+ HTTP requests per 30 seconds per user just from passive polling.

**Fix:** 
- Remove `refetchInterval` from all hooks that are already covered by WebSocket invalidation (`notifications`, `dashboard stats`, `decisions`, `conversations`). 
- Keep `refetchInterval` only on hooks where WebSocket doesn't push updates (SLA — 60s is fine).
- Add `refetchOnWindowFocus: true` as fallback catch-up instead of constant polling.
- For `useUnreadNotificationCount` — derive from the `useNotifications` cache instead of a separate API call fetching limit=1 just to get `total`.

---

#### 7. Notification unread count: full query just to get a count
**File:** `frontend/src/hooks/use-notifications.ts` (line 132-141)

```ts
queryFn: async () => {
  const response = await listNotifications({ unread_only: true, limit: 1 });
  return response.total;
}
```
This hits `/api/v1/notifications/?unread_only=true&limit=1` — which still does a `COUNT(*)` query AND fetches 1 notification row just to discard it. There's a dedicated `/api/v1/notifications/unread-count` endpoint that only returns `{"unread_count": N}`. Use it.

---

#### 8. Connection pool undersized for workload
**File:** `backend/app/db/session.py` (lines 8-13)

```python
pool_size=10,
max_overflow=20,
```
With 10+ background scheduler jobs, WebSocket handlers, and concurrent HTTP requests, under load you'll hit pool exhaustion. FastAPI + asyncpg is capable of saturating this quickly.

**Fix:** Tune to `pool_size=20, max_overflow=40` or derive from `WEB_CONCURRENCY` env. Also set `pool_timeout=30` explicitly to fail fast rather than queue indefinitely.

---

#### 9. Redis cache only used in ONE service
**File:** `backend/app/services/dashboard_aggregation_service.py`

Redis is running (Docker), but caching is only applied to dashboard aggregation. The following endpoints are called on every page load with zero caching:
- `/api/v1/reports/*` — heavy JOIN queries, change rarely
- `/api/v1/partners/` list — called from sidebar, stable data
- `/api/v1/clients/` list — same
- `/api/v1/sla/` status — queried every minute
- Search suggestions — popular_searches are hardcoded, entity name queries could be cached 5-10s

**Fix:** Add Redis caching to:
1. `search_suggestions()` with 5s TTL (identical queries per keypress)
2. SLA status with 60s TTL (already polled at 60s)
3. Partner/client list with 30s TTL (stable data, WS invalidates on change)

---

#### 10. `useUnreadNotificationCount` duplicates `useNotifications` work
See item #7 above. Beyond the API call waste, `NotificationBell` and `use-notifications.ts` both separately subscribe to notification data with different query keys (`["notifications", "unread-count"]` vs `["notifications", params]`). This means TWO separate cache entries that both poll independently.

**Fix:** Single source of truth — `useUnreadNotificationCount` should read from the `useNotifications` cache if populated, else fetch the count endpoint.

---

### 🟡 P2 — Medium Leverage

#### 11. Font loading: 3 Google fonts loaded at root layout
**File:** `frontend/src/app/layout.tsx` (lines 12-28)

Three Google fonts (`Geist`, `IBM_Plex_Mono`, `Playfair_Display`) are loaded via `next/font/google`. These are self-hosted by Next.js automatically (no external request) but all three are loaded on **every** page including login/auth pages that only use `Geist`. `Playfair_Display` with italic variants is ~100KB extra that's only used for decorative headings.

**Fix:** Move `IBM_Plex_Mono` and `Playfair_Display` to a separate `(dashboard)/layout.tsx`-scoped font injection (CSS variable approach), or use `display: 'swap'` + `preload: false` for non-critical fonts.

---

#### 12. `"use client"` on dashboard layout forces all children to be client components
**File:** `frontend/src/app/(dashboard)/layout.tsx` (line 1)

The entire dashboard layout is `"use client"` meaning React Server Components can't be used for any content inside it. Every page re-renders fully on client. The layout includes: sidebar, breadcrumbs, notification bell, command palette — all client-side. But the page content (tables, lists, cards) could be RSC with client islands.

This is an architectural concern — fixing it requires refactoring. Flag for future work; the immediate win is ensuring `Suspense` boundaries are placed correctly (already partially done).

---

#### 13. Audit log: synchronous within transaction, fires on EVERY flush
**File:** `backend/app/core/audit_listener.py` (lines 241-260)

The `after_flush` SQLAlchemy event fires on every `session.flush()` — including background jobs, scheduler tasks, seeding. For bulk operations (import service, `seed_demo.py`), this creates an audit log entry per row. The `import_service.py` is 44KB of bulk insert code. An import of 100 clients creates 100 audit entries within the same transaction, adding significant write amplification.

**Fix:** Add a session-level flag to suppress audit logging during bulk operations: `session.info["skip_audit"] = True`. Check this flag at the top of `after_flush`. Already has `SKIP_TABLES`, just needs a runtime bypass.

---

#### 14. `selectinload` chains on every detail endpoint
**Files:** `backend/app/api/v1/clearance_certificates.py`, `access_audits.py`, etc.

Multiple endpoints load 4-6 relationships via `selectinload` even when the response schema only uses 2-3 of them. Example: `clearance_certificates.py` loads `client`, `program`, `template`, `creator`, `reviewer`, `history` on every read — that's 6 extra SELECT statements per request.

**Fix:** Only load relationships that are actually used in the response schema. Audit the `selectinload` chains vs schema fields across the heaviest endpoints.

---

#### 15. `docker-compose.yml` missing Postgres tuning
The default PostgreSQL 17 config is tuned for a tiny embedded system. `shared_buffers`, `work_mem`, `effective_cache_size`, `max_connections` are all at defaults. For a portal with complex JOIN queries, this is leaving significant performance on the table.

**Fix:** Add Postgres config overrides in `docker-compose.yml` command section:
```
shared_buffers=256MB
work_mem=16MB  
effective_cache_size=1GB
max_connections=100
```

---

## Priority Matrix

| # | Issue | Effort | Impact | Where |
|---|-------|--------|--------|-------|
| 1 | Search parallel queries | S | 🔴 Critical | `global_search_service.py` |
| 2 | pg_trgm indexes + ilike | M | 🔴 Critical | new migration + search service |
| 3 | at-risk-programs double fetch | S | 🔴 Critical | `dashboard.py` + `use-dashboard.ts` |
| 4 | portfolio RAG in Python | M | 🟠 High | `dashboard.py` |
| 5 | activity feed UNION ALL | M | 🟠 High | `dashboard_aggregation_service.py` |
| 6 | Polling tsunami | S | 🟠 High | 6+ hook files |
| 7 | unread-count API waste | S | 🟠 High | `use-notifications.ts` |
| 8 | Connection pool size | S | 🟠 High | `session.py` |
| 9 | Redis caching gaps | M | 🟡 Medium | search.py, sla, partner list |
| 10 | Duplicate notification cache | S | 🟡 Medium | `use-notifications.ts` |
| 11 | Font loading scope | S | 🟡 Medium | `layout.tsx` |
| 12 | RSC opportunity | L | 🟡 Medium | dashboard layout |
| 13 | Audit log bulk bypass | S | 🟡 Medium | `audit_listener.py` |
| 14 | selectinload over-fetching | M | 🟡 Medium | various API files |
| 15 | Postgres config | S | 🟡 Medium | `docker-compose.yml` |

---

## Steps

1. Parallelize global search: wrap all 5 `_search_*` coroutines in `asyncio.gather()` in `GlobalSearchService.search()` in `backend/app/services/global_search_service.py`
2. Parallelize search suggestions: wrap the 8 separate prefix/contains queries in `asyncio.gather()` in `backend/app/api/v1/search.py::search_suggestions()`
3. Add Alembic migration for `pg_trgm` extension and GIN trigram indexes on `programs.title`, `clients.name`, `partner_profiles.firm_name`, `documents.file_name`, `tasks.title`
4. Switch `func.lower(col).like(f"%{term}%")` to `col.ilike(f"%{term}%")` throughout `global_search_service.py` and `search.py` to leverage trgm indexes
5. Fix double dashboard fetch: remove `/at-risk-programs` API endpoint from `backend/app/api/v1/dashboard.py`, update `useAtRiskPrograms()` in `frontend/src/hooks/use-dashboard.ts` to derive from `useProgramHealth()` cache with client-side filtering
6. Fix portfolio RAG computation: replace Python-side ORM load in `get_portfolio_summary()` with a SQL aggregate subquery that computes red/amber/green counts directly in `backend/app/api/v1/dashboard.py`
7. Fix activity feed: replace 3 sequential queries + Python sort with a single SQL `UNION ALL` query with server-side `ORDER BY` and `LIMIT/OFFSET` in `backend/app/services/dashboard_aggregation_service.py`
8. Kill polling tsunami: remove `refetchInterval` from `useRealTimeStats`, `useActivityFeed`, `useDashboardAlerts` in `frontend/src/hooks/use-dashboard.ts` (WebSocket already pushes updates); add `refetchOnWindowFocus: true`
9. Kill notification polling: remove `refetchInterval` from `useNotifications` and `useGroupedNotifications` in `frontend/src/hooks/use-notifications.ts`; fix `useUnreadNotificationCount` to call the `/unread-count` endpoint instead of `listNotifications({ unread_only: true, limit: 1 })`
10. Tune DB connection pool: update `pool_size=20, max_overflow=40, pool_timeout=30` in `backend/app/db/session.py`
11. Add Redis caching to search suggestions in `backend/app/api/v1/search.py` with 5s TTL
12. Add bulk audit bypass: add `session.info.get("skip_audit")` check at top of `after_flush` in `backend/app/core/audit_listener.py`; set the flag in `backend/app/services/import_service.py`
13. Add Postgres performance tuning to `docker-compose.yml` via command-line config args
