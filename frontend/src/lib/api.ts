import axios from "axios";

import { API_BASE_URL } from "@/lib/config";
import {
  setTokens,
  removeTokens,
} from "@/lib/token-storage";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
  timeout: 30000,
});

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
    const originalRequest = error.config;

    // Extract backend error message for all errors (unified `message` field,
    // with `detail` fallback for any non-custom responses)
    const data = error.response?.data;
    if (data?.message) {
      error.message = data.message;
    } else if (data?.detail) {
      error.message = data.detail;
    }

    // Skip interceptor for the refresh endpoint itself to avoid deadlocks
    const isRefreshRequest = originalRequest.url?.includes("/auth/refresh");
    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshRequest) {
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
