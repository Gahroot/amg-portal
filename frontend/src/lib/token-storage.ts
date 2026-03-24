/**
 * Centralized token storage utilities for auth token management.
 * Handles SSR safety and localStorage errors gracefully.
 */

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

/**
 * Safely get an item from localStorage, handling SSR and errors.
 */
function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safely set an item in localStorage, handling SSR and errors.
 */
function safeSetItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Silent fail
  }
}

/**
 * Safely remove an item from localStorage, handling SSR and errors.
 */
function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Silent fail
  }
}

/**
 * Get the access token from localStorage.
 */
export function getAccessToken(): string | null {
  return safeGetItem(ACCESS_TOKEN_KEY);
}

/**
 * Get the refresh token from localStorage.
 */
export function getRefreshToken(): string | null {
  return safeGetItem(REFRESH_TOKEN_KEY);
}

/**
 * Store both access and refresh tokens in localStorage.
 */
export function setTokens(accessToken: string, refreshToken: string): void {
  safeSetItem(ACCESS_TOKEN_KEY, accessToken);
  safeSetItem(REFRESH_TOKEN_KEY, refreshToken);
}

/**
 * Remove both access and refresh tokens from localStorage.
 */
export function removeTokens(): void {
  safeRemoveItem(ACCESS_TOKEN_KEY);
  safeRemoveItem(REFRESH_TOKEN_KEY);
}
