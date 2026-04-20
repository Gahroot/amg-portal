# AMG Portal — 4 Deployment Blockers Fix Plan

**Goal**: Get the app deployable for client testing this weekend.  
**Time estimate**: ~2 hours total across 4 parallel tasks.

---

## Analysis

### Blocker 1: No Dockerfiles
The `docker-compose.yml` only defines infrastructure (Postgres, Redis, MinIO). There are no `Dockerfile`s for the backend or frontend. The backend uses `uv` (has `uv.lock` + `pyproject.toml`) and needs system deps for WeasyPrint (PDF generation). The frontend is Next.js 16 with a standard `build`/`start` setup. Both need multi-stage production Dockerfiles, and `docker-compose.yml` needs new `backend` and `frontend` service definitions. A `.dockerignore` is also needed at the root.

**Backend details**:
- Python 3.12+, `uv` package manager (`pyproject.toml` + `uv.lock`)
- Needs system libs: WeasyPrint requires `libpango`, `libcairo`, `libgdk-pixbuf`, etc.
- Entrypoint: `gunicorn` (listed in deps) with `uvicorn` workers
- Serves on port 8000

**Frontend details**:
- Next.js 16, Node 22 LTS, `npm` (has `package-lock.json`)
- Standard `next build` → `next start` (port 3000)
- Needs `NEXT_PUBLIC_API_URL` at build time

### Blocker 2: Alembic Migration Chain is Broken
Two distinct problems:
- **Duplicate revision ID**: Both `add_notification_indexes.py` and `add_last_generated_document_id.py` use revision `a1b2c3d4e5f6`. Alembic will crash on this.
- **Orphaned roots**: `add_budget_approval_routing`, `add_clearance_certificates`, and `esc_response_deadline_01` all have `down_revision = None` instead of pointing to a parent. However, all three ARE referenced as parents by downstream migrations (`8f6a47efa18a` merges budget+clearance, `add_escalation_rules` merges esc_response_deadline), so they're reachable but they create additional root branches that break the single-chain assumption.

The existing merge `45ff9a1104a8` already merges 8 heads into one. Then `encrypt_mfa` → `f8a2c3d4e5b6` sits on that chain. Then `add_notification_indexes` (duplicate ID!) claims to follow `f8a2c3d4e5b6`.

**Fix approach**: 
- Rename `add_notification_indexes`'s revision from `a1b2c3d4e5f6` to a unique ID like `notif_indexes_01`
- Update `add_report_favorites`'s down_revision tuple to reference the new ID (it depends on `a1b2c3d4e5f6`, which should now specifically mean `add_last_generated_document_id`)
- Fix the 3 orphan roots by pointing their `down_revision` to logical parents in the existing chain (they're all additive CREATE TABLE migrations that depend on the `users`/`programs`/`clients` tables existing, so they can safely depend on `ddc5d4fef8cd` which creates those core tables)

### Blocker 3: No Backend `.env.example`
The frontend already has `frontend/.env.example`. The backend has no `.env.example` — operators must read `config.py` (147 lines) to figure out what env vars are needed. We need a `backend/.env.example` generated from `backend/app/core/config.py`.

### Blocker 4: MinIO Ports Bound to 0.0.0.0
In `docker-compose.yml`, Postgres and Redis are correctly bound to `127.0.0.1`, but MinIO ports are exposed on all interfaces (`9000:9000` and `9001:9001`). This means MinIO's API and console would be publicly accessible on any server.

---

## Risks

- **Alembic chain**: The fix touches revision IDs and down_revisions across multiple files. Getting a single reference wrong breaks the whole chain. After fixing, we MUST run `cd backend && alembic heads` and `alembic history` to verify a single head with no errors.
- **Docker builds**: WeasyPrint system deps are finicky. The Dockerfile must be tested with `docker compose build`.
- **Duplicate revision ID `a1b2c3d4e5f6`**: `add_report_favorites` has `down_revision: tuple[str, ...] = ("add_document_expiry", "a1b2c3d4e5f6")`. Since this was written when `add_last_generated_document_id` was the only migration with that ID, the reference should stay pointed at `add_last_generated_document_id`. The notification indexes migration is the newer duplicate that gets renamed.

---

## Steps

1. Create `backend/Dockerfile` — multi-stage build: `uv` for deps in builder stage, slim runtime with WeasyPrint system deps (`libpango1.0-0`, `libcairo2`, `libgdk-pixbuf-2.0-0`, `libffi-dev`, `libglib2.0-0`), copy app, run with `gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000`
2. Create `frontend/Dockerfile` — multi-stage: `node:22-alpine` builder for `npm ci && npm run build`, slim runner with `next start`, expose port 3000, set `NEXT_PUBLIC_API_URL` as build arg
3. Create root `.dockerignore` with `.git`, `node_modules`, `__pycache__`, `.next`, `.env*`, `*.md`, etc.
4. Update `docker-compose.yml` — add `backend` and `frontend` services with build contexts, env vars from `.env`, `depends_on` for postgres/redis/minio, and fix MinIO ports from `"9000:9000"` / `"9001:9001"` to `"127.0.0.1:9000:9000"` / `"127.0.0.1:9001:9001"`
5. Fix duplicate Alembic revision ID: in `backend/alembic/versions/add_notification_indexes.py`, change `revision` from `"a1b2c3d4e5f6"` to `"notif_indexes_01"` and update the docstring `Revision ID` line to match; also update `down_revision` in any migration that references `a1b2c3d4e5f6` and means the notification indexes (currently none do — `add_report_favorites` references it meaning `add_last_generated_document_id`, so no downstream change needed)
6. Fix 3 orphaned Alembic roots: change `down_revision` from `None` to `"ddc5d4fef8cd"` in `add_budget_approval_routing.py`, `add_clearance_certificates.py`, and `add_escalation_response_deadline.py` (the core tables migration creates users/programs/clients that these migrations depend on; all three are already merged downstream into `8f6a47efa18a` and `add_escalation_rules` respectively, so the chain topology is preserved)
7. Create `backend/.env.example` listing every env var from `backend/app/core/config.py` with their defaults, grouped by section (App, Database, Redis, JWT, CORS, MinIO, Frontend/Backend URLs, MFA, Password Reset, Proxies, Rate Limiting, Scheduler, Data Retention, SMTP, Travel, Google Calendar, Microsoft Calendar, Security Feed, DocuSign), with comments explaining which are required in production
8. Verify all changes: run `cd backend && alembic heads` (should show exactly 1 head), run `docker compose config` to validate the compose file, and run `docker compose build` to confirm both Dockerfiles build successfully
