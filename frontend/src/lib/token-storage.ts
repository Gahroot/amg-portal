/**
 * Centralized auth state utilities.
 *
 * Tokens are now stored in httpOnly cookies set by the backend.
 * JavaScript cannot read them directly (which prevents XSS token theft).
 * These helpers manage a lightweight in-memory/cookie flag so the UI can
 * check "are we logged in?" without touching the actual JWT.
 */

const AUTH_FLAG_KEY = "has_session";

/**
 * Check if the user likely has an active session.
 * This reads a non-httpOnly flag cookie that the frontend sets alongside
 * the backend's httpOnly token cookies.  It does NOT expose the JWT.
 */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    // Return a truthy sentinel if the session flag is present.
    // Callers only need to know "is there a token?" — the actual JWT
    // is sent automatically via cookies.
    return document.cookie.includes(AUTH_FLAG_KEY + "=1") ? "__cookie__" : null;
  } catch {
    return null;
  }
}

/**
 * @deprecated Refresh tokens are now managed via httpOnly cookies.
 * Kept for backward compatibility — always returns null.
 */
export function getRefreshToken(): string | null {
  return null;
}

/**
 * Mark that we have an active session (called after login / token refresh).
 * The actual JWTs are in httpOnly cookies set by the server.
 */
export function setTokens(_accessToken: string, _refreshToken: string): void {
  if (typeof window === "undefined") return;
  try {
    // Set a lightweight, non-httpOnly flag so client JS can detect "logged in".
    const secureFlag = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${AUTH_FLAG_KEY}=1; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax${secureFlag}`;
  } catch {
    // Silent fail
  }
}

/**
 * Clear the session flag (called on logout).
 * The server-side logout endpoint clears the httpOnly cookies.
 */
export function removeTokens(): void {
  if (typeof window === "undefined") return;
  try {
    const secureFlag = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${AUTH_FLAG_KEY}=; path=/; max-age=0; samesite=lax${secureFlag}`;
  } catch {
    // Silent fail
  }
}
