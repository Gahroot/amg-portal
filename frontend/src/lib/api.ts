import axios from "axios";

import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  removeTokens,
} from "@/lib/token-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
  timeout: 30000,
});

export function logout(): void {
  removeTokens();
  // Notify the auth provider so it can clear React state and redirect.
  // Avoids a hard window.location redirect that races with router.replace.
  window.dispatchEvent(new Event("auth:logout"));
}

// Request interceptor — attach JWT
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

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

    // Extract backend error message for all errors
    if (error.response?.data?.detail) {
      error.message = error.response.data.detail;
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

      const refreshTokenValue = getRefreshToken();

      if (!refreshTokenValue) {
        logout();
        return Promise.reject(error);
      }

      try {
        const response = await api.post("/api/v1/auth/refresh", {
          refresh_token: refreshTokenValue,
        });

        const { access_token, refresh_token } = response.data;
        setTokens(access_token, refresh_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;

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
