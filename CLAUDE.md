# AMG Portal

Client and partner management platform for Anchor Mill Group — delivering bespoke programs to ultra-high-net-worth individuals, family offices, and global executives. Three portals: internal staff dashboard, partner portal, and client portal. Features include program lifecycle management, partner scoring/governance, KYC/compliance, SLA tracking, communications with audit trails, reporting/analytics, and real-time WebSocket collaboration.

## Project Structure

```
docker-compose.yml                # Infrastructure: PostgreSQL 17, Redis 7, MinIO
backend/                          # Python FastAPI backend
  ├── alembic/versions/           # 90 database migrations
  ├── app/
  │   ├── api/v1/                 # 169 REST route handlers
  │   ├── core/                   # Settings, security, rate limiting, exceptions
  │   ├── db/                     # Session management, Redis client, seed scripts
  │   ├── middleware/             # Audit logging, security headers
  │   ├── models/                 # 82 SQLAlchemy ORM models (one file per entity)
  │   ├── schemas/                # 81 Pydantic request/response schemas (mirrors models)
  │   ├── services/               # 73 business logic services (one file per domain)
  │   ├── templates/              # Jinja2 email/PDF templates
  │   └── utils/                  # Shared utilities
  └── tests/                      # 29 pytest test files
frontend/                         # Next.js 16 App Router frontend
  └── src/
      ├── app/                    # 154 pages: (dashboard), (partner), (portal), auth flows
      ├── components/             # 249 React components (33 feature dirs + ui/ primitives)
      ├── hooks/                  # 71 custom React hooks
      ├── lib/                    # 92 API clients, validations, utilities
      ├── stores/                 # Zustand state management
      ├── providers/              # React context providers
      ├── types/                  # 41 TypeScript type definitions (manual + generated.ts)
      └── config/                 # Navigation configuration
mobile/                           # React Native (Expo + NativeWind) — 110 files
  ├── app/                        # Expo Router: (auth), (client), (internal), (partner)
  ├── components/                 # Shared components (biometrics, voice, offline)
  ├── hooks/                      # 13 hooks (auth, biometrics, offline, speech-to-text)
  └── lib/                        # API clients, auth store, query client
integrations/                     # Make.com scenarios, Zapier triggers/actions
```

## Tech Stack

- **Frontend**: TypeScript 5.9, Next.js 16, React 19, Tailwind CSS 4, shadcn/Radix UI, Zustand 5, TanStack Query 5, React Hook Form 7 + Zod 4, Recharts 3
- **Backend**: Python 3.12+, FastAPI ≥0.115, SQLAlchemy 2 (async/asyncpg), Pydantic 2, Alembic, APScheduler, WeasyPrint
- **Mobile**: React Native 0.83, Expo 55, NativeWind 4, Zustand 5, TanStack Query 5
- **Infrastructure**: PostgreSQL 17, Redis 7, MinIO (all Dockerized)
- **Integrations**: Google Calendar, DocuSign, TOTP/MFA, async email (aiosmtplib)
- **Linting**: ESLint 9 (frontend), Ruff (backend), mypy strict (backend), tsc --noEmit (frontend)
- **Testing**: Vitest 4 + Testing Library (frontend), pytest 8 + pytest-asyncio (backend)
- **Package Mgmt**: npm (frontend/mobile), uv (backend)

## Organization Rules

- API routes → `backend/app/api/v1/`, one file per resource
- ORM models → `backend/app/models/`, one file per entity
- Pydantic schemas → `backend/app/schemas/`, matching model files
- Business logic → `backend/app/services/`, one file per domain
- React components → `frontend/src/components/`, one per file
- Pages → `frontend/src/app/`, following Next.js App Router conventions
- Types → `frontend/src/types/`; prefer `generated.ts` over manual types
- Single responsibility per file — no catch-all modules

## Code Quality

Run after editing **any** file. Fix **all** errors and warnings before continuing.

```bash
# Backend
cd backend && ruff check . && mypy .

# Frontend
cd frontend && npm run lint && npm run typecheck
```

## Dev Commands

```bash
docker compose up -d                          # Start PostgreSQL, Redis, MinIO

cd backend && alembic upgrade head            # Run migrations
cd backend && uvicorn app.main:app --reload   # Backend dev server

cd frontend && npm run dev                    # Frontend dev server
cd frontend && npm run build                  # Production build

cd backend && pytest                          # Backend tests
cd frontend && npm run test                   # Frontend tests (vitest)

cd frontend && npm run generate:types         # Regenerate TS types from OpenAPI (backend must be running)

cd mobile && npm run start                    # Expo dev server
cd mobile && npm run android                  # Android dev
cd mobile && npm run ios                      # iOS dev
```

## Type Generation

Frontend types in `frontend/src/types/` are being migrated to auto-generated types from the FastAPI OpenAPI schema.

- **Generated**: `frontend/src/types/generated.ts` — run `npm run generate:types` to refresh
  - Import: `import type { components } from "@/types/generated";`
  - Use: `type User = components["schemas"]["User"];`
- **Manual**: `user.ts`, `program.ts`, etc. — gradually migrate to re-export from `generated.ts`; keep frontend-only UI state/computed fields here

**When backend schemas change:** update Pydantic schema → restart backend → `npm run generate:types` → update frontend usages.

## Railway Deployment

Production is deployed on Railway (project: `amg-portal`, environment: `production`).

**Architecture**: Frontend and backend are on separate Railway subdomains — this is a cross-origin setup. Auth cookies use `SameSite=none; Secure` with the `__Host-` prefix and a CSRF double-submit cookie (`__Host-csrf`) + `X-CSRF-Token` header on state-changing requests. CSP in `frontend/src/middleware.ts` is nonce-strict for `script-src` (nonce consumed by `src/app/layout.tsx` reading `headers().get("x-nonce")`); `style-src` still uses `'unsafe-inline'` because Tailwind/Radix require it.

**Services**: `backend`, `frontend`, `Postgres` (Railway-managed)

**Deploying** — `railway up` always uploads from the git root. Use `--path-as-root` to scope to a service subdirectory:

```bash
# Deploy backend
railway up --service=backend --path-as-root /path/to/amg-portal/backend --detach

# Deploy frontend
railway up --service=frontend --path-as-root /path/to/amg-portal/frontend --detach

# Check deployment status
railway deployment list --service=backend
railway deployment list --service=frontend

# View logs (build vs runtime)
railway logs --service=backend --build --latest --lines=50   # build logs
railway logs --service=backend --lines=50                    # runtime logs

# Restart without rebuilding
railway restart --service=backend --yes

# Redeploy last successful image (no code changes)
railway redeploy --service=backend --yes
```

**Database access** — Railway's internal DB URL (`postgres.railway.internal`) is only reachable inside Railway's network. For local scripts that hit production:

```bash
# Direct psql
psql "postgresql://postgres:<password>@maglev.proxy.rlwy.net:51818/railway"

# Run backend scripts with public DB URL override
cd backend && DATABASE_URL="postgresql+asyncpg://postgres:<password>@maglev.proxy.rlwy.net:51818/railway" DEBUG=true python3 -m scripts.seed_demo_data

# Run Alembic migrations against production
cd backend && DATABASE_URL="postgresql+asyncpg://postgres:<password>@maglev.proxy.rlwy.net:51818/railway" DEBUG=true alembic upgrade head
```

The public Postgres host/port is in Railway's `Postgres` service variables (`DATABASE_PUBLIC_URL`). Check with: `railway variables --service=Postgres`

**Demo accounts** — 6 accounts with password `Demo1234!`, MFA skipped via `MFA_EXEMPT_EMAILS` env var:
`md@`, `rm@`, `coordinator@`, `finance@`, `client@`, `partner@` (all `@anchormillgroup.com`)

**Seed data**: `python3 -m scripts.seed_demo_data` populates clients, programs, tasks, etc. Uses `get_or_create` so it's idempotent.
