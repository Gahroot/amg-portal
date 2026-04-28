import axios from "axios";
import type { AxiosRequestConfig } from "axios";

import { API_BASE_URL } from "@/lib/config";
import {
  CSRF_HEADER_NAME,
  getCsrfToken,
  isMutatingMethod,
} from "@/lib/csrf";
import {
  setTokens,
  removeTokens,
} from "@/lib/token-storage";

const STEP_UP_HEADER = "X-Step-Up-Token";

type RetriedRequestConfig = AxiosRequestConfig & {
  _retry?: boolean;
  _stepUpRetry?: boolean;
  _skipStepUp?: boolean;
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
  timeout: 30000,
});

// CSRF double-submit: echo the ``__Host-csrf`` cookie into the
// ``X-CSRF-Token`` header on every state-changing request. If the cookie
// is absent (not logged in, or the session hasn't established it yet),
// we let the request go through unmodified — the backend will return 403
// and the caller sees it as any other API error.
//
// Pattern source: https://github.com/piccolo-orm/piccolo_admin/blob/master/admin_ui/src/main.ts
api.interceptors.request.use((config) => {
  if (isMutatingMethod(config.method)) {
    const token = getCsrfToken();
    if (token) {
      config.headers.set(CSRF_HEADER_NAME, token);
    }
  }
  return config;
});

function extractStepUpAction(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  // Custom exception body shape: { error, message, detail: {...} } — the
  // step-up marker may live on either `data.error` or `data.detail.error`.
  const root = data as Record<string, unknown>;
  if (root.error === "step_up_required" && typeof root.action === "string") {
    return root.action;
  }
  const detail = root.detail;
  if (detail && typeof detail === "object") {
    const d = detail as Record<string, unknown>;
    if (d.error === "step_up_required" && typeof d.action === "string") {
      return d.action;
    }
  }
  return null;
}

export function logout(): void {
  // Fire-and-forget: ask the server to clear httpOnly cookies
  api.post("/api/v1/auth/logout").catch(() => {});
  removeTokens();
  // Notify the auth provider so it can clear React state and redirect.
  // Avoids a hard window.location redirect that races with router.replace.
  window.dispatchEvent(new Event("auth:logout"));
}

// Response interceptor — token refresh on 401
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetriedRequestConfig;

    // Extract backend error message for all errors (unified `message` field,
    // with `detail` fallback for any non-custom responses)
    const data = error.response?.data;
    const stepUpAction = extractStepUpAction(data);
    if (data?.message) {
      error.message = data.message;
    } else if (typeof data?.detail === "string") {
      error.message = data.detail;
    } else if (data?.detail?.message) {
      error.message = data.detail.message;
    }

    // Step-up re-auth (RFC 9470): the backend returns 401 with
    // ``detail.error === "step_up_required"`` and ``detail.action`` naming
    // the scope that's missing. Prompt the user, then retry once with
    // ``X-Step-Up-Token``.
    if (
      error.response?.status === 401 &&
      stepUpAction &&
      !originalRequest._stepUpRetry &&
      !originalRequest._skipStepUp
    ) {
      const { useStepUpStore } = await import("@/stores/step-up");
      const store = useStepUpStore.getState();
      const cached = store.getValidToken(stepUpAction);
      const token = cached ?? (await store.requestToken(stepUpAction));
      if (!token) {
        return Promise.reject(error);
      }
      originalRequest._stepUpRetry = true;
      originalRequest.headers = {
        ...(originalRequest.headers ?? {}),
        [STEP_UP_HEADER]: token,
      };
      return api(originalRequest);
    }

    // Skip the refresh-on-401 retry for endpoints that don't represent an
    // authenticated request — a 401 there is a real auth failure (e.g. wrong
    // password on /login), not an expired access token. Without this guard,
    // a wrong-password 401 would trigger /auth/refresh, which then returns
    // "Missing refresh token", and that error bubbles up to the user instead
    // of "Invalid email or password".
    const url = originalRequest.url ?? "";
    const isUnauthenticatedAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/register") ||
      url.includes("/auth/forgot-password") ||
      url.includes("/auth/reset-password");
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isUnauthenticatedAuthEndpoint
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Refresh token is sent automatically via httpOnly cookie
        const response = await api.post("/api/v1/auth/refresh");

        const { access_token, refresh_token } = response.data;
        // Update the session flag (actual tokens are in httpOnly cookies)
        setTokens(access_token, refresh_token);

        processQueue(null);
        isRefreshing = false;

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(error);
        isRefreshing = false;
        logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
