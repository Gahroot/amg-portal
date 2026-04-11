/**
 * Centralized environment configuration.
 *
 * Single source of truth for the backend API base URL and the derived
 * WebSocket base URL. All frontend modules should import from here instead
 * of reading `process.env.NEXT_PUBLIC_API_URL` directly so the fallback
 * default lives in exactly one place.
 *
 * Mirrored on mobile in `mobile/lib/config.ts` (uses `EXPO_PUBLIC_API_URL`).
 */

/** Backend API base URL — falls back to local dev server. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** WebSocket base URL — derived from API_BASE_URL by swapping the scheme. */
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");
