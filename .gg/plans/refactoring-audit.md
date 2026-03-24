# AMG Portal — Comprehensive Refactoring Audit

## Backend

### 1. `compute_rag_status` is defined 3 times
- Defined in `backend/app/api/v1/programs.py` (lines 49–57)
- Defined again in `backend/app/services/report_service.py` (lines 21–34, with a comment saying "Reuse compute_rag_status from programs.py" — but it doesn't actually reuse it)
- Implemented inline in `backend/app/api/v1/client_portal.py` as `_compute_rag_status` (line 79)
- **Fix:** Extract to a shared utility module (e.g. `app/utils/rag.py`) and import from there everywhere.

### 2. Custom exception hierarchy defined but never used
- `NotFoundException`, `BadRequestException`, `ForbiddenException`, `ConflictException`, `ValidationException` are all defined in `core/exceptions.py` and registered as exception handlers in `main.py`.
- Every single API route raises raw `fastapi.HTTPException` instead.
- **Fix:** Replace all `raise HTTPException(status_code=404, ...)` with `raise NotFoundException(...)`, etc.

### 3. Service layer imports and raises `fastapi.HTTPException`
- `archival_service.py`, `client_service.py`, `closure_service.py`, `deletion_service.py`, `program_state_machine.py`, `storage.py` all import `fastapi.HTTPException` and raise it directly.
- Services should not be coupled to the HTTP layer — they should raise domain exceptions.
- **Fix:** Replace with the custom exceptions from `core/exceptions.py`.

### 4. `BudgetApprovalService` instantiated per-request (21 times)
- Every endpoint in `budget_approvals.py` does `service = BudgetApprovalService(db)` inline.
- Other services (`NotificationService`, `ReportService`, `CertificateService`) are module-level singletons.
- **Fix:** Either make it a singleton injected via FastAPI dependency (like `Depends(get_budget_approval_service)`) or align with the singleton pattern used elsewhere.

### 5. `require_client` role checker lives in the wrong module
- Defined as a module-level variable inside `client_portal.py` (line 74), then imported from there by `reports.py`.
- All other role checkers (`require_internal`, `require_admin`, etc.) live in `api/deps.py`.
- **Fix:** Move `require_client` to `api/deps.py` alongside all other role checkers.

### 6. ORM models use raw `str` for enum fields
- `User.role`, `User.status`, `Program.status`, `Client.status`, etc. are all `Mapped[str]` even though they map to `StrEnum` values.
- String literals like `"active"`, `"completed"`, `"done"` are scattered throughout the codebase in comparisons.
- **Fix:** Use `Mapped[UserRole]` (or the relevant enum) for enum-backed columns to get compile-time safety.

### 7. `build_program_response` / `build_program_detail_response` bypass Pydantic schemas
- These helpers in `programs.py` use `{c.key: getattr(program, c.key) for c in program.__table__.columns}` — raw ORM reflection that bypasses schema validation, aliasing, and computed fields.
- **Fix:** Use Pydantic's `model_validate(program, from_attributes=True)` with the response schemas.

### 8. Inconsistent `model_config` declaration style across schemas
- Some schemas: `model_config = ConfigDict(from_attributes=True)` (e.g., `access_audit.py`, `capability_review.py`)
- Most schemas: `model_config = {"from_attributes": True}` (dict literal, e.g., `approval.py`, `auth.py`, `budget_approval.py`)
- **Fix:** Standardize on `ConfigDict` everywhere (it's the proper Pydantic v2 API and gives IDE type checking).

### 9. Deferred imports inside scheduler job functions
- In `scheduler_service.py`, most job functions do their imports inside the function body (e.g., `from app.models.enums import ...`, `from app.services.escalation_service import ...` inside `_check_milestone_risks_job`).
- This is a symptom of circular import issues.
- **Fix:** Audit and fix the circular dependency chain properly so imports can be at the top of the file.

### 10. `AuditContextMiddleware.dispatch` has an untyped parameter
- `middleware/audit.py` line 16: `async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[no-untyped-def]`
- **Fix:** Add proper type annotation (`call_next: RequestResponseEndpoint`) like `SecurityHeadersMiddleware` already does.

### 11. `get_client_id_from_user` in `reports.py` is wrong
- Line 46: `result = await db.execute(select(Client).where(Client.rm_id == current_user.id))` — this gets the **RM's** client, not the logged-in client user's client record.
- The comment says "For now, raise an error" — this function is currently broken for its intended purpose (getting a client user's own client ID).
- **Fix:** Look up via `ClientProfile.user_id == current_user.id` or `Client` joined through the proper relationship.

### 12. `SecurityHeadersMiddleware` defined inline in `main.py`
- The middleware class is defined directly in `main.py` rather than in the `app/middleware/` directory where `audit.py` lives.
- **Fix:** Move to `app/middleware/security.py`.

### 13. `CRUDBase` is missing a `delete` method
- `services/crud_base.py` has `get`, `get_multi`, `create`, `update` — but no `delete`.
- Deletions are handled ad-hoc in every endpoint/service that needs them.
- **Fix:** Add a `delete(db, *, id)` method to `CRUDBase`.

### 14. No shared `TimestampMixin` — `created_at` / `updated_at` repeated on every model
- Every model file (50+) manually declares the same `created_at` and `updated_at` columns with identical default lambdas.
- **Fix:** Extract to a `TimestampMixin` class in `db/base.py` and have models inherit from it.

### 15. `date.today()` used instead of timezone-aware equivalent
- In `report_service.py` (line 24) and `scheduler_service.py` (line 133), `date.today()` is called.
- This uses the server's local timezone rather than UTC, which is inconsistent with `datetime.now(UTC)` used everywhere else.
- **Fix:** Use `datetime.now(UTC).date()` consistently.

### 16. `python-jose` is an unmaintained dependency
- `pyproject.toml` depends on `python-jose[cryptography]`. This library is unmaintained (last release 2021) and has known security issues.
- **Fix:** Migrate JWT handling to `PyJWT` which is actively maintained.

### 17. `structlog` is a dependency but never used
- `pyproject.toml` includes `structlog>=24.4.0` but every module uses `logging.getLogger(__name__)` from the standard library.
- **Fix:** Either integrate `structlog` properly throughout, or remove it from `pyproject.toml`.

### 18. Hardcoded token expiry in `create_password_reset_token`
- `security.py` hardcodes `timedelta(minutes=15)` for password reset tokens.
- All other token expiries are driven by settings (`ACCESS_TOKEN_EXPIRE_MINUTES`, `MFA_SETUP_TOKEN_EXPIRE_MINUTES`, etc.).
- **Fix:** Add `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 15` to `Settings` and use it.

### 19. `main.py` has a misplaced `import` statement mid-file
- Line 134: `from app.middleware.audit import AuditContextMiddleware  # noqa: E402  # isort: skip`
- This import is at module scope after function definitions to avoid a circular import — the `# noqa` and `# isort: skip` are band-aids.
- **Fix:** Fix the underlying circular dependency so the import can be at the top.

### 20. Alembic migration files with duplicated names
- `6bce34dcf2df_add_document_and_kyc_document.py` and `82526a45a2c4_add_document_and_kyc_document.py` appear to cover the same feature and have identical names.
- Migration file naming is also inconsistent: some are descriptive (`add_budget_approval_routing.py`), others are autogenerated slugs (`04dc48f4efa6_add_user_model.py`).
- **Fix:** Audit migration chain for duplicates; standardize naming convention.

---

## Frontend

### 21. Inconsistent TanStack Query cache keys for programs
- `use-programs.ts` uses `["programs", id]` as the cache key for a single program.
- `programs/[id]/page.tsx`, `programs/[id]/board/page.tsx`, `use-closure.ts`, and several components use `["program", programId]` (singular, without the "s").
- This causes the same data to be fetched and stored twice under different keys, and mutations invalidating one key won't update the other.
- **Fix:** Standardize on `["programs", id]` everywhere and use the `useProgram(id)` hook rather than inline `useQuery`.

### 22. `"use client"` directive on hook files
- Every file in `frontend/src/hooks/` (40+ files) starts with `"use client";`.
- Next.js `"use client"` marks a **component** as a client component. Hook files don't need this — hooks are always client-side by nature.
- **Fix:** Remove `"use client"` from all hook files under `src/hooks/`.

### 23. `console.log` / `console.error` in production code
- 30+ instances found, including a debug `console.log("Saving draft...", methods.getValues())` left in `intake-wizard.tsx`.
- Many components use bare `console.error(error)` without showing user feedback (no toast).
- **Fix:** Remove debug logs; replace `console.error(error)` with proper error handling (toast + optional structured logging service).

### 24. Page components bypass custom hooks and call API directly
- `programs/[id]/page.tsx` calls `useQuery({ queryFn: () => getProgram(programId) })` directly instead of using `useProgram(programId)` from `use-programs.ts`.
- Same pattern in `certificates/page.tsx`, `certificates/[id]/page.tsx`, `certificates/new/page.tsx`, and others.
- This duplicates query configuration and means cache key changes need to be made in multiple places.
- **Fix:** All pages should use custom hooks from `src/hooks/` rather than calling API functions directly.

### 25. Token helper functions duplicated between `api.ts` and `auth-provider.tsx`
- `api.ts` has `safeGetItem`, `safeSetItem`, `safeRemoveItem` (localStorage wrappers).
- `auth-provider.tsx` independently defines `getToken`, `setTokens`, `removeTokens` doing the same thing.
- **Fix:** Extract to a single `lib/token-storage.ts` module and import from both places.

### 26. `lib/api/` files re-export types they don't own
- E.g., `lib/api/programs.ts` imports 14 types from `types/program.ts` and immediately re-exports all of them.
- Callers can import directly from `types/` — the re-export chain adds unnecessary indirection.
- **Fix:** Remove the re-exports from `lib/api/` files; have consumers import types directly from `src/types/`.

### 27. Zod validation schemas only exist for programs
- `lib/validations/program.ts` is the only validation file — all other forms (client intake, partner onboarding, etc.) have no Zod schemas.
- **Fix:** Add Zod schemas for all major forms.

### 28. `AuthGuard` returns `null` while unauthenticated
- `components/auth/auth-guard.tsx` returns `null` when `!isAuthenticated`, causing a blank flash before the auth-provider redirect fires.
- **Fix:** Return a loading skeleton or redirect immediately rather than rendering nothing.

### 29. `PUBLIC_PATHS` list is incomplete
- `auth-provider.tsx` defines `PUBLIC_PATHS = ["/login", "/mfa-setup"]`.
- `/forgot-password` and `/reset-password` exist as pages but are not in `PUBLIC_PATHS`, meaning an authenticated user who navigates there would immediately be redirected away.
- **Fix:** Add all public route paths to `PUBLIC_PATHS`.

### 30. WebSocket accumulates all messages in state (memory leak)
- `use-websocket.ts` line 147: `setMessages((prev) => [...prev, message])` — messages are appended without any limit or cleanup.
- In a long-running session this will consume unbounded memory.
- **Fix:** Either cap the message history (e.g., keep last 100) or remove the `messages` state entirely since no component appears to consume it.

### 31. WebSocket token passed in URL query string
- `use-websocket.ts` line 49: `const wsUrl = apiUrl.replace(/^http/, "ws") + "/ws?token=" + token`
- The JWT is exposed in browser history, server access logs, and any proxy logs.
- **Fix:** Connect without the token in the URL, then send it as the first message (already a supported pattern in the backend's `handle_message`), or use a short-lived WS ticket issued via a REST endpoint.

### 32. `ErrorBoundary` exposes raw error messages in production
- `error-boundary.tsx` renders `{this.state.error?.message || "An unexpected error occurred"}` directly.
- Internal error messages can leak implementation details in production.
- **Fix:** Show a generic message in production; only show `error.message` in dev (check `process.env.NODE_ENV`).

### 33. `ROLE_LABELS` constant duplicated across files
- `dashboard/page.tsx` defines `ROLE_LABELS: Record<string, string>` mapping role keys to display names.
- This mapping likely exists or should exist in a shared location — similar mappings appear in navigation configs and elsewhere.
- **Fix:** Move to `src/lib/constants.ts` or `src/types/user.ts`.

---

## Mobile (`mobile/`)

### 34. No token refresh logic
- `mobile/lib/api.ts` response interceptor only deletes the token and redirects to login on 401 — no refresh attempt.
- The web frontend has full refresh logic (retry queue, refresh token storage).
- **Fix:** Implement the same token refresh flow used in `frontend/src/lib/api.ts`.

### 35. `UserRole` type defined independently in all three codebases
- `backend/app/models/enums.py` → `UserRole` StrEnum
- `frontend/src/types/user.ts` → `User.role` string union type
- `mobile/lib/auth-store.ts` → `UserRole` type alias
- Three separate definitions that can drift out of sync.
- **Fix:** Generate TypeScript types from the OpenAPI schema (e.g., using `openapi-typescript`) to keep frontend and mobile in sync with the backend.

---

## Cross-Cutting

### 36. `expo/` directory contains abandoned work
- `expo/budget-approvals/` appears to be an incomplete/abandoned alternative to the `mobile/` app.
- **Fix:** Either migrate its contents to `mobile/` or delete it entirely.

### 37. Two `docker-compose.yml` files
- One at the project root, one at `backend/docker-compose.yml`.
- **Fix:** Consolidate into one with a clear README explaining which to use.

### 38. No generated types between backend and frontend
- API response shapes are manually duplicated in `frontend/src/types/` and `mobile/types/`. Any backend schema change requires manual updates in both client codebases.
- **Fix:** Use `openapi-typescript` (or similar) to auto-generate `types/` from FastAPI's OpenAPI schema.

### 39. Backend tests cover ~40% of API surface
- Tests exist for auth, programs, clients, escalations, budget approvals, deliverables, NPS, SLA, reports, RBAC, and a few others.
- Missing: partners, partner capabilities, partner portal, communications, documents, KYC, tasks, scheduling, travel, access audits, clearance certificates, capability reviews, workload, notifications, decisions, deletion requests, intake, dashboard, and more.
- **Fix:** Incrementally add test coverage for untested routes.

### 40. Frontend has only one test file
- `frontend/src/hooks/__tests__/use-clients.test.ts` is the only frontend test.
- **Fix:** Add tests for custom hooks, key components, and auth flows.
