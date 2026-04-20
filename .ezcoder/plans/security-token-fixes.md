# Security Fix Plan: MFA Setup Token + has_session Cookie

## Analysis

### Fix 1 — MFA setup token → httpOnly cookie

**Current flow:**
1. `POST /api/v1/auth/login` returns `mfa_setup_token` in JSON body
2. Frontend (`auth-provider.tsx:135`) stores it in `sessionStorage` via `storeMFASetupToken()`
3. Frontend (`auth.ts:76–83`) reads it from `sessionStorage` and manually attaches `Authorization: Bearer <token>` to `/mfa/setup` and `/mfa/verify-setup` requests
4. Backend `deps.py:get_mfa_setup_user()` extracts via `_extract_token()` → reads from `Authorization` header OR `access_token` cookie

**Target flow:**
1. Backend login sets `mfa_setup_token` as an httpOnly cookie (short-lived, same pattern as `access_token`)
2. Cookie is sent automatically on `/mfa/setup` and `/mfa/verify-setup` — no JS storage needed
3. Backend `get_mfa_setup_user()` reads from cookie `mfa_setup_token` (in addition to / instead of the Authorization header path)
4. Frontend removes all `sessionStorage` usage and manual `Bearer` header attachment
5. The `mfa_setup_token` field in the JSON body of the login response is kept as `null` always (for API compatibility) OR removed — we'll keep it as `null` to avoid breaking the schema

**Files to touch:**
- `backend/app/api/v1/auth.py` — add `_set_mfa_setup_cookie()`, call it in the two login paths, add `_clear_mfa_setup_cookie()` (called after `verify-setup` completes)
- `backend/app/api/deps.py` — update `get_mfa_setup_user()` to also check `request.cookies.get("mfa_setup_token")`
- `frontend/src/lib/api/auth.ts` — remove `getMFASetupToken`, `storeMFASetupToken`, `clearMFASetupToken`; remove manual `Authorization` header logic from `setupMFA()` and `verifyMFASetup()`
- `frontend/src/providers/auth-provider.tsx` — remove `storeMFASetupToken` import and call
- `frontend/src/components/auth/mfa-setup.tsx` — remove `clearMFASetupToken` import and call
- `frontend/src/hooks/__tests__/use-auth.test.ts` — remove mock and assertions for `storeMFASetupToken`

### Fix 2 — has_session cookie missing Secure flag

**Current code** (`token-storage.ts:45`):
```js
document.cookie = `${AUTH_FLAG_KEY}=1; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
```

**Current clear** (`token-storage.ts:58`):
```js
document.cookie = `${AUTH_FLAG_KEY}=; path=/; max-age=0; samesite=lax`;
```

**Fix:** Append `; secure` when `window.location.protocol === 'https:'` to both lines.

**Files to touch:**
- `frontend/src/lib/token-storage.ts` — add conditional `; secure` to both set and clear

---

## Detailed Change Notes

### backend/app/api/v1/auth.py

Add a `_set_mfa_setup_cookie()` helper (after `_set_auth_cookies`):
```python
def _set_mfa_setup_cookie(response: Response, token: str) -> None:
    """Set a short-lived httpOnly cookie for the MFA setup token."""
    is_secure = not settings.DEBUG
    response.set_cookie(
        key="mfa_setup_token",
        value=token,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        max_age=settings.MFA_SETUP_TOKEN_EXPIRE_MINUTES * 60,
        path="/api/v1/auth/mfa",  # scoped to MFA endpoints only
    )
```

Add `_clear_mfa_setup_cookie()`:
```python
def _clear_mfa_setup_cookie(response: Response) -> None:
    response.delete_cookie(key="mfa_setup_token", path="/api/v1/auth/mfa")
```

In `login()`:
- Both MFA-not-setup paths (grace period + hard enforcement) call `_set_mfa_setup_cookie(response, setup_token)` and return `mfa_setup_token=None` in the JSON body (token no longer in body)
- Signature already has `response: Response`

In `mfa_verify_setup()`:
- After `_set_auth_cookies(response, ...)`, call `_clear_mfa_setup_cookie(response)` to remove the setup cookie

### backend/app/api/deps.py

In `get_mfa_setup_user()`, update `_extract_token` usage:

The current code calls `_extract_token(bearer_token, request)` which checks `Authorization` header then `access_token` cookie. We need to also check `mfa_setup_token` cookie.

Replace the token extraction with:
```python
token = _extract_token(bearer_token, request) or request.cookies.get("mfa_setup_token")
```

This preserves backward compatibility (Authorization header still works for users who have a real `access_token` via the grace-period path) while also supporting the cookie path for hard-enforcement users.

### frontend/src/lib/api/auth.ts

- Remove lines 45–70 (`getMFASetupToken`, `storeMFASetupToken`, `clearMFASetupToken`)
- Simplify `setupMFA()` to just call `api.post<MFASetupResponse>("/api/v1/auth/mfa/setup", {})` — no extra headers
- Simplify `verifyMFASetup()` to just call `api.post<AuthResponse>("/api/v1/auth/mfa/verify-setup", { code })` — no extra headers

### frontend/src/providers/auth-provider.tsx

- Remove `storeMFASetupToken` from imports (line 8)
- Remove the `storeMFASetupToken(response.mfa_setup_token)` call (line 135)
- The `mfa_setup_token` field check block (`if (response.mfa_setup_token)`) is removed entirely

### frontend/src/components/auth/mfa-setup.tsx

- Remove `clearMFASetupToken` from imports (line 11)
- Remove `clearMFASetupToken()` call (line 71)

### frontend/src/hooks/__tests__/use-auth.test.ts

- Remove `mockStoreMFASetupToken` declaration and mock (lines 10, 15)
- Remove `storeMFASetupToken` from the `vi.mock("@/lib/api/auth", ...)` mock factory (line 15)
- Remove assertions `expect(mockStoreMFASetupToken).toHaveBeenCalledWith(...)` (lines 255, 280)
- The `mfa_setup_token` field in test responses can remain as-is or be set to `null`

### frontend/src/lib/token-storage.ts

In `setTokens()` (line 45):
```ts
const secureFlag = window.location.protocol === 'https:' ? '; secure' : '';
document.cookie = `${AUTH_FLAG_KEY}=1; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax${secureFlag}`;
```

In `removeTokens()` (line 58):
```ts
const secureFlag = window.location.protocol === 'https:' ? '; secure' : '';
document.cookie = `${AUTH_FLAG_KEY}=; path=/; max-age=0; samesite=lax${secureFlag}`;
```

---

## Steps
1. Add `_set_mfa_setup_cookie()` and `_clear_mfa_setup_cookie()` helpers to `backend/app/api/v1/auth.py`, call them in the login endpoint (both MFA-not-setup branches), and call `_clear_mfa_setup_cookie()` in `mfa_verify_setup()`; set `mfa_setup_token=None` in the JSON responses
2. Update `get_mfa_setup_user()` in `backend/app/api/deps.py` to also read `mfa_setup_token` from the cookie, falling back from the existing header/access_token check
3. Remove `getMFASetupToken`, `storeMFASetupToken`, `clearMFASetupToken` from `frontend/src/lib/api/auth.ts` and simplify `setupMFA()` and `verifyMFASetup()` to drop manual Authorization headers
4. Remove `storeMFASetupToken` import and call from `frontend/src/providers/auth-provider.tsx`
5. Remove `clearMFASetupToken` import and call from `frontend/src/components/auth/mfa-setup.tsx`
6. Update `frontend/src/hooks/__tests__/use-auth.test.ts` to remove `storeMFASetupToken` mock and related assertions
7. Add conditional `; secure` flag to `setTokens()` and `removeTokens()` in `frontend/src/lib/token-storage.ts`
8. Run `cd backend && ruff check . && mypy .` and `cd frontend && npm run lint && npm run typecheck` to verify no errors
