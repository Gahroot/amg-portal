# Session Management — Implementation Plan

## Overview
Add persistent session tracking so users can see and revoke all active sessions
across devices. Sessions are identified via a `sid` (session ID) claim embedded in
JWT tokens. The DB is the source of truth for active vs. revoked sessions.

---

## Architecture Decisions

- **`UserSession`** ORM model — one row per login, stores IP, user-agent, last activity.
- `sid` claim (UUID string) embedded in every access token + refresh token.
- `get_current_user` dependency checks the session is not revoked on each request
  (one extra DB query per authenticated request — acceptable for enterprise app).
- Password confirmation required for revoke operations (not MFA code).
- Email notification sent to user when any session is revoked.
- No new dependencies — user-agent parsing done with simple string matching.
- Current session is identified by matching the `sid` in the request's JWT against
  the session list returned by the API.

---

## Files to Create / Modify

### Backend
| File | Action |
|---|---|
| `backend/app/models/user_session.py` | **new** — UserSession ORM model |
| `backend/app/schemas/auth.py` | **modify** — add session schemas |
| `backend/app/core/security.py` | **modify** — embed `sid` in tokens |
| `backend/app/api/deps.py` | **modify** — validate `sid` in `get_current_user` |
| `backend/app/api/v1/auth.py` | **modify** — create session on login, add session endpoints |
| `backend/app/services/email_service.py` | **modify** — add session revocation email |
| `backend/app/models/__init__.py` | **modify** — register UserSession |
| `backend/alembic/versions/add_user_sessions.py` | **new** — migration |

### Frontend
| File | Action |
|---|---|
| `frontend/src/lib/api/sessions.ts` | **new** — typed API client |
| `frontend/src/components/settings/session-manager.tsx` | **new** — UI component |
| `frontend/src/app/(dashboard)/settings/security/page.tsx` | **modify** — add SessionManager |

---

## Step-by-Step Implementation

### Step 1 — ORM Model (`backend/app/models/user_session.py`)

```python
class UserSession(Base):
    __tablename__ = "user_sessions"
    __table_args__ = (
        Index("ix_user_sessions_user_id", "user_id"),
        Index("ix_user_sessions_session_id", "session_id", unique=True),
    )
    id: UUID PK
    user_id: FK users.id CASCADE
    session_id: str(36)  # UUID string, embedded as `sid` in JWT
    ip_address: str(45) nullable
    user_agent: str(512) nullable
    device_name: str(100) nullable   # derived from UA: "Chrome on macOS" etc.
    is_revoked: bool default False
    last_activity_at: DateTime(tz)
    created_at: DateTime(tz)
```

No TimestampMixin (no `updated_at` needed — we write `last_activity_at` manually).

### Step 2 — Pydantic Schemas (add to `backend/app/schemas/auth.py`)

```python
class UserSessionResponse(BaseModel):
    session_id: str
    ip_address: str | None
    device_name: str | None
    is_current: bool
    last_activity_at: datetime
    created_at: datetime

class SessionListResponse(BaseModel):
    sessions: list[UserSessionResponse]

class RevokeSessionRequest(BaseModel):
    password: str

class RevokeAllOtherSessionsRequest(BaseModel):
    password: str
```

### Step 3 — Security Changes (`backend/app/core/security.py`)

- `create_access_token(data, session_id=None)` — if `session_id` provided, adds `{"sid": session_id}` to payload
- `create_refresh_token(data, session_id=None)` — same
- No changes to decode functions needed (they already return the full payload dict)

### Step 4 — Deps Changes (`backend/app/api/deps.py`)

In `get_current_user`:
1. After decoding token, extract `payload.get("sid")` 
2. If `sid` present: query `UserSession` where `session_id == sid AND is_revoked == False`
3. If session not found or revoked → raise 401
4. Update `last_activity_at` to now (fire-and-forget / no await needed — but use await since async)
5. If no `sid` in token (legacy tokens): allow through without session check (backward compat)

Also expose `sid` so endpoints can use it:
- Add `get_current_session_id` helper that returns `sid | None` from the token
- Add `CurrentSessionId = Annotated[str | None, Depends(get_current_session_id)]` type alias

### Step 5 — Auth Endpoints Changes (`backend/app/api/v1/auth.py`)

**Modify login:**
```python
# After MFA validation, before returning Token:
session_id = str(uuid.uuid4())
session = UserSession(
    user_id=user.id,
    session_id=session_id,
    ip_address=request.client.host if request.client else None,
    user_agent=request.headers.get("user-agent"),
    device_name=parse_device_name(request.headers.get("user-agent", "")),
    last_activity_at=datetime.now(UTC),
    created_at=datetime.now(UTC),
)
db.add(session)
await db.commit()
token_data = {"sub": str(user.id), "email": user.email}
return Token(
    access_token=create_access_token(token_data, session_id=session_id),
    refresh_token=create_refresh_token(token_data, session_id=session_id),
)
```

The `login` endpoint needs `Request` injected: `request: Request` parameter.

**Add device name helper:**
```python
def parse_device_name(ua: str) -> str:
    # Simple browser/OS detection from UA string
    browser = "Unknown Browser"
    if "Chrome" in ua and "Edg" not in ua and "OPR" not in ua:
        browser = "Chrome"
    elif "Firefox" in ua:
        browser = "Firefox"
    elif "Safari" in ua and "Chrome" not in ua:
        browser = "Safari"
    elif "Edg" in ua:
        browser = "Edge"
    
    os = "Unknown OS"
    if "Windows" in ua:
        os = "Windows"
    elif "Macintosh" in ua or "Mac OS X" in ua:
        os = "macOS"
    elif "Linux" in ua:
        os = "Linux"
    elif "iPhone" in ua or "iPad" in ua:
        os = "iOS"
    elif "Android" in ua:
        os = "Android"
    
    return f"{browser} on {os}"
```

**Add new endpoints:**

```
GET  /auth/sessions              → SessionListResponse  (CurrentUser)
DELETE /auth/sessions/{sid}      → 204  (CurrentUser, body: RevokeSessionRequest)
DELETE /auth/sessions            → 204  (CurrentUser, body: RevokeAllOtherSessionsRequest)
```

For GET /sessions: query all non-revoked UserSession rows for current user, sorted by last_activity DESC. Mark `is_current` by comparing each `session_id` to the `sid` extracted from the request's auth token.

For DELETE /sessions/{sid}: verify password, mark that session as revoked, send email.

For DELETE /sessions (revoke all others): verify password, mark all OTHER sessions as revoked, send email.

**Modify `login` (MFA grace-period path):** also create session and embed `sid` for the access token / setup token paths.

Actually to keep it simple, only create a session for the "real token" path (both MFA-complete path and grace-period path that returns real tokens). The hard-enforcement path (access_token="") does NOT create a session.

### Step 6 — Email Notification (`backend/app/services/email_service.py`)

Add `send_session_revoked_email(email, name, device_name, ip_address)`.

### Step 7 — Migration (`backend/alembic/versions/add_user_sessions.py`)

```python
revision = "add_user_sessions"
down_revision = "add_escalation_playbooks"
```

Creates `user_sessions` table with columns and indexes.

### Step 8 — `backend/app/models/__init__.py`

Add: `from app.models.user_session import UserSession  # noqa: F401`

### Step 9 — Frontend API Client (`frontend/src/lib/api/sessions.ts`)

```typescript
export interface UserSession {
  session_id: string;
  ip_address: string | null;
  device_name: string | null;
  is_current: boolean;
  last_activity_at: string;
  created_at: string;
}

export interface SessionListResponse {
  sessions: UserSession[];
}

export async function getSessions(): Promise<SessionListResponse>
export async function revokeSession(sessionId: string, password: string): Promise<void>
export async function revokeAllOtherSessions(password: string): Promise<void>
```

### Step 10 — SessionManager Component (`frontend/src/components/settings/session-manager.tsx`)

UI sections:
1. **Card header** — "Active Sessions" / description
2. **Session list** — for each session:
   - Device icon (Monitor/Smartphone/Globe based on device_name)
   - `device_name` (bold)
   - IP address (muted, small)
   - Last activity (relative time: "2 hours ago")
   - "Current session" badge for `is_current`
   - "Revoke" button (disabled for current session)
3. **"Revoke all other sessions"** button at bottom
4. **Password confirmation dialog** — Dialog with password input, shown for both revoke actions

Uses `useQuery` for fetching sessions. Uses `useMutation` for revoke. Toast on success/error.

### Step 11 — Update Security Page

Add `<SessionManager />` below existing cards in `security/page.tsx`.

---

## API Summary

| Route | Auth | Description |
|---|---|---|
| `GET /api/v1/auth/sessions` | any user | List active sessions |
| `DELETE /api/v1/auth/sessions/{sid}` | any user | Revoke specific session |
| `DELETE /api/v1/auth/sessions` | any user | Revoke all other sessions |

---

## Quality Checks

```bash
cd backend && ruff check . && mypy .
cd frontend && npm run lint && npm run typecheck
```
