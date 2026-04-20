/**
 * CSRF double-submit helpers.
 *
 * The backend sets a non-HttpOnly ``__Host-csrf`` cookie whose value is an
 * HMAC bound to the current session. Every mutating request (POST/PUT/PATCH/
 * DELETE) must echo the cookie value back in an ``X-CSRF-Token`` header; the
 * backend then checks cookie == header and verifies the HMAC. Because a
 * cross-origin attacker cannot read the cookie (``__Host-`` first-party-only
 * + ``SameSite=none; Secure``), they cannot forge the header — so even with
 * ``SameSite=none`` cookies this closes the CSRF vector.
 *
 * See ``backend/app/middleware/csrf.py`` for the server side of the contract.
 *
 * Pattern cribbed from proven production implementations:
 *   - https://github.com/piccolo-orm/piccolo_admin (axios interceptor scoped
 *     to mutating methods)
 *   - https://github.com/shridarpatil/whatomate (regex-based cookie reader
 *     with decodeURIComponent)
 */

/** The cookie name set by the backend. The ``__Host-`` prefix is part of the name. */
export const CSRF_COOKIE_NAME = "__Host-csrf";

/** The header name the backend checks on every mutating request. */
export const CSRF_HEADER_NAME = "X-CSRF-Token";

/** HTTP methods that the backend considers state-changing. */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Read a cookie by name from ``document.cookie``.
 *
 * Returns ``null`` when the cookie is absent or when not running in a
 * browser (e.g. server-side rendering). Handles URL-encoded values and
 * strips surrounding double quotes per RFC 6265 quoted-string form.
 */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  // Match ";name=value" at start or after "; ". The name is escaped because
  // ``__Host-`` contains regex-significant chars (only ``-``, but be safe).
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + escaped + "=([^;]*)"),
  );
  if (!match) {
    return null;
  }
  let value = match[1];
  // Strip surrounding double quotes (RFC 6265 permits quoted cookie values).
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  }
  try {
    return decodeURIComponent(value);
  } catch {
    // Malformed percent-encoding — hand back the raw string so the request
    // still fails closed at the backend rather than masking the issue here.
    return value;
  }
}

/** Return ``true`` when the given HTTP method requires a CSRF header. */
export function isMutatingMethod(method: string | undefined): boolean {
  if (!method) {
    return false;
  }
  return MUTATING_METHODS.has(method.toUpperCase());
}

/**
 * Return the current CSRF token, or ``null`` if the cookie is not present.
 *
 * The cookie is minted by the backend on login/refresh; a ``null`` here
 * typically means the user is logged out or the login response hasn't
 * landed yet. Callers should let the request proceed either way — the
 * backend returns a clean 403 which surfaces as a normal API error.
 */
export function getCsrfToken(): string | null {
  return getCookie(CSRF_COOKIE_NAME);
}
