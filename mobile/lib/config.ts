/**
 * Centralized environment configuration for the mobile app.
 *
 * Single source of truth for the backend API base URL and the derived
 * `/api/v1` and WebSocket URLs. All mobile modules should import from here
 * instead of reading `process.env.EXPO_PUBLIC_API_URL` directly so the
 * fallback default lives in exactly one place.
 *
 * Mirrors `frontend/src/lib/config.ts`. The `EXPO_PUBLIC_API_URL` env var
 * should be the raw backend origin (e.g. `https://api.example.com`); the
 * `/api/v1` suffix is appended here so callers can pick the URL that fits
 * their endpoint (REST handlers under `/api/v1/...`, WebSocket at `/ws`).
 */

/** Raw backend origin — falls back to local dev server. */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

/** REST API root: `${API_BASE_URL}/api/v1`. */
export const API_V1_URL = `${API_BASE_URL}/api/v1`;

/** WebSocket base URL — derived from API_BASE_URL by swapping the scheme. */
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');
