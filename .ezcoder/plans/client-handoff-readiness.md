# Client Handoff Readiness Plan

## Situation Assessment

The client portal is substantially built. Here's what's already in great shape:

### ✅ Already Done — No Action Needed
- **Error boundaries** — `ErrorBoundary` class component + Next.js `error.tsx` / `global-error.tsx` at every level
- **Frontend error logging** — `ErrorLoggerProvider` captures unhandled errors, promise rejections, console.error, and 4xx/5xx Axios failures, batches them every 2 seconds, and POSTs to `/api/error-log`
- **Backend error log route** — `/api/error-log` writes structured logs to `.ezcoder/errors.log` (dev only; production endpoint is a no-op stub)
- **Backend exception handlers** — consistent JSON shape for `AppException`, `HTTPException`, `ValidationError`, and generic 500s; all sanitized before reaching client
- **Audit trail** — SQLAlchemy `after_flush` listener logs every create/update/delete to `audit_logs` table with user ID, email, IP, before/after state
- **Auth guard + role routing** — `AuthProvider` redirects clients to `/portal/dashboard`, staff to `/`, partners to `/partner`; `PortalLayout` blocks non-clients
- **Security headers** — CORS, HSTS, CSP, XSS protection applied both in FastAPI middleware and Next.js config
- **Rate limiting** — login, register, forgot-password, refresh all rate-limited via Redis
- **Token refresh** — Axios interceptor queues failed requests and retries after refresh; auto-logout on refresh failure
- **MFA** — TOTP setup flow + grace period enforced at backend
- **Client portal pages** — dashboard, programs, documents, messages, decisions, reports, calendar, schedule, settings (profile/notifications/security), survey, updates

### ⚠️ Gaps to Address Before Handoff

**Critical (must fix today):**
1. **Error log is dev-only** — `route.ts` returns `{ok:true}` early in production without storing errors anywhere. When the client hits a bug in a hosted environment, you'll be blind. Need to forward errors to a persistent backend log endpoint or a simple file/service.
2. **No structured backend logging config** — `uvicorn` logs go to stdout with no format/level configuration. No log file. In a hosted/VPS scenario errors disappear on restart.
3. **Backend `.env` doesn't exist** — no `.env` file found in `backend/`. The app runs on defaults (DEBUG=False forces SECRET_KEY, MFA_ENCRYPTION_KEY, etc.). Either the env is set in the shell or the app is crashing at startup. Need to verify and document.
4. **SMTP not configured** — `SMTP_HOST` is `None` by default; password reset emails, notifications, and digest emails all silently fail. Client won't receive any emails.
5. **Demo data / first user** — Is there a client user account provisioned? The client needs credentials to log in.

**Nice to have (if time permits):**
6. **Production error forwarding** — Wire the `/api/error-log` Next.js route to POST errors to the FastAPI backend (`POST /api/v1/…/frontend-errors`) so they land in the server log even in production.
7. **Health check page** — A quick `/health` backend check you can hit to confirm everything is up.
8. **"Contact support" button** — Client portal error screens say "contact support" but there's no email/link. Wire a mailto or message link.

**Not needed today (Phase 2/3 scope):**
- Sentry / Datadog / Posthog — overkill for initial hands-on review, adds complexity
- Full production deployment hardening

---

## The Game Plan (2–3 hours)

### Phase 1: Verify the system runs (~30 min)
- Confirm Docker services are up (postgres, redis, minio)
- Run migrations (`alembic upgrade head`)
- Start backend (`uvicorn app.main:app --reload`) — confirm no startup crash
- Start frontend (`npm run dev`) — confirm it loads

### Phase 2: Provision the client account (~15 min)
- Run `python -m app.db.seed` to create the admin user
- Use the admin UI (staff portal) to create a client account for the actual client
- Set a temporary password and note the login URL

### Phase 3: Fix the 3 critical observability gaps (~45 min)
- Add a backend logging config (structured JSON to stdout + file)
- Fix `/api/error-log` to work in all environments (write to a log file regardless of NODE_ENV, or forward to backend)
- Add a `NEXT_PUBLIC_SUPPORT_EMAIL` env var and wire it into error screens

### Phase 4: Smoke test the client portal (~30 min)
- Log in as client → dashboard renders
- Programs page → shows programs (if demo data seeded)
- Messages → send a test message
- Documents → view/download a document
- Settings → update profile
- Log in as staff → confirm you can see audit logs for client's actions

### Phase 5: Handoff (~15 min)
- Send client login credentials + portal URL
- Tell them what's live (programs, messages, documents, decisions)
- Tell them what's coming (Phase 2/3 features)
- You watch `.ezcoder/errors.log` (dev) or server logs (prod) for issues

---

## Steps
1. Add structured logging configuration to the FastAPI backend (`backend/app/main.py`) — configure `logging.basicConfig` with a JSON-friendly format, write to stdout, and optionally to `backend/app.log` so errors persist across restarts
2. Fix `frontend/src/app/api/error-log/route.ts` to write errors in all environments (not just `NODE_ENV === development`) — use an env var `ERROR_LOG_ENABLED=true` or always write; keep log rotation logic
3. Add `NEXT_PUBLIC_SUPPORT_EMAIL` env var support and update `frontend/src/components/error/error-boundary.tsx`, `frontend/src/app/error.tsx`, and `frontend/src/app/global-error.tsx` to show a "Email support" link using that address instead of generic "contact support" text
4. Verify and document the backend `.env` setup — check if `backend/.env` exists, create a `.env.example` in `backend/` documenting all required variables (SECRET_KEY, MFA_ENCRYPTION_KEY, SMTP_*, CORS_ORIGINS, FRONTEND_URL) with safe placeholder values
5. Confirm demo/seed data path — verify that `python -m app.db.seed` works and that there is a script or documented flow to create a client user account via the staff portal
