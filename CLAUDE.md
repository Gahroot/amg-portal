# AMG Portal

A client and partner management platform for delivering bespoke programs to ultra-high-net-worth individuals, family offices, and global executives. Unifies client intelligence, partner coordination, program execution, and reporting with role-based access control.

## Project Structure

```
docker-compose.yml                # Infrastructure: PostgreSQL, Redis, MinIO

backend/                          # Python FastAPI backend
  ├── alembic/                   # Database migrations
  ├── app/
  │   ├── api/v1/               # API routes (auth, users, clients, programs, partners, deliverables, approvals)
  │   ├── core/                 # Settings, security, dependencies
  │   ├── db/                   # Database session management
  │   ├── models/               # SQLAlchemy ORM models
  │   ├── schemas/              # Pydantic request/response schemas
  │   └── services/             # Business logic (CRUD base, email, storage)

frontend/                         # Next.js (v16) React frontend
  └── src/
      ├── app/                  # App Router pages — (dashboard), (partner), (portal), login
      ├── components/           # React components (auth, programs, ui)
      ├── hooks/                # Custom React hooks
      ├── lib/                  # Utilities, API clients (lib/api/), validations
      ├── providers/            # React context providers
      └── types/                # TypeScript type definitions
```

## Tech Stack

- **Frontend**: TypeScript, Next.js 16, React 19, Tailwind CSS 4, Radix UI, Zustand, TanStack Query
- **Backend**: Python 3.12+, FastAPI, SQLAlchemy (async), Pydantic, Alembic
- **Infrastructure**: PostgreSQL 17, Redis 7, MinIO

## Organization Rules

- API routes go in `backend/app/api/v1/`, one file per resource
- ORM models go in `backend/app/models/`, one file per entity
- Pydantic schemas go in `backend/app/schemas/`, matching model files
- Business logic goes in `backend/app/services/`
- React components go in `frontend/src/components/`, one per file
- Pages go in `frontend/src/app/`, following Next.js App Router conventions
- Types go in `frontend/src/types/`
- Keep files focused — single responsibility per file

## Code Quality

After editing ANY file, run the relevant checks:

**Backend:**
```bash
cd backend && ruff check . && mypy .
```

**Frontend:**
```bash
cd frontend && npm run lint && npm run typecheck
```

Fix ALL errors and warnings before continuing.

## Dev Commands

```bash
# Backend
cd backend && uvicorn app.main:app --reload

# Frontend
cd frontend && npm run dev

# Infrastructure
docker compose up -d   # PostgreSQL, Redis, MinIO

# Database migrations
cd backend && alembic upgrade head

# Type generation (requires backend running)
cd frontend && npm run generate:types   # Generate TypeScript from OpenAPI schema
```

## Type Generation

Frontend types in `frontend/src/types/` are being migrated to auto-generated types from the FastAPI OpenAPI schema.

**Generated types:** `frontend/src/types/generated.ts`
- Run `npm run generate:types` to regenerate (requires backend at localhost:8000)
- Import as: `import type { components } from "@/types/generated";`
- Use as: `type User = components["schemas"]["User"];`

**Manual types:** Files like `user.ts`, `program.ts`, `client.ts` contain manually maintained types.
- These should gradually migrate to re-export from `generated.ts`
- Keep frontend-specific extensions (UI state, computed fields) in manual files

**Workflow when backend schemas change:**
1. Update backend Pydantic schemas in `backend/app/schemas/`
2. Restart backend to refresh OpenAPI spec
3. Run `cd frontend && npm run generate:types`
4. Update frontend code to use new generated types
