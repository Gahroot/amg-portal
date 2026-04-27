import axios from 'axios';
import * as SecureStore from '@/lib/secure-storage';
import { router } from 'expo-router';

import { API_V1_URL } from '@/lib/config';
import { buildIntegrityHeader } from '@/lib/device-integrity';

const TOKEN_KEY = 'amg_auth_token';
const REFRESH_TOKEN_KEY = 'amg_refresh_token';

/**
 * Cert pinning is enforced at the OS/TLS layer via the Expo config plugin
 * `mobile/plugins/withCertificatePinning.js` (Android `network_security_config.xml`
 * + iOS `NSPinnedDomains`). No JS-level pin library is required because the
 * system trust store rejects mismatching certs before the request leaves the
 * platform networking stack — see `docs/security-runbooks/mobile-cert-pinning.md`.
 */
const api = axios.create({
  baseURL: API_V1_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Compact device-integrity digest — backend uses it to flag suspicious
  // sessions (security-plan §7.13). Always send so missing-header == old client.
  config.headers['X-Device-Integrity'] = buildIntegrityHeader();
  return config;
});

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

let isLoggingOut = false;

export async function logout(): Promise<void> {
  if (isLoggingOut) return;
  isLoggingOut = true;
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync('amg_auth_user');
    router.replace('/(auth)/login');
  } finally {
    // Reset after navigation so subsequent sessions can log out again
    setTimeout(() => {
      isLoggingOut = false;
    }, 2000);
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Extract backend error message for all errors. FastAPI validation errors
    // return `detail` as an array of {msg, loc, ...} objects — coerce to a
    // string so `err.message` stays a string for UI rendering.
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') {
      error.message = detail;
    } else if (Array.isArray(detail)) {
      error.message = detail
        .map((d) => (typeof d === 'string' ? d : d?.msg ?? JSON.stringify(d)))
        .join('; ');
    }

    // If the request never reached the network (thrown request interceptor,
    // some CORS/network failures) axios rejects without a `config` — bail out
    // before touching any `originalRequest.*` fields.
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Skip interceptor for the refresh endpoint itself to avoid deadlocks
    const isRefreshRequest = originalRequest.url?.includes('/auth/refresh');
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

      const refreshTokenValue = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

      if (!refreshTokenValue) {
        await logout();
        return Promise.reject(error);
      }

      try {
        // Use a fresh axios instance for refresh to avoid interceptor recursion
        const response = await axios.post(
          `${API_V1_URL}/auth/refresh`,
          { refresh_token: refreshTokenValue },
        );

        const { access_token, refresh_token } = response.data;
        await SecureStore.setItemAsync(TOKEN_KEY, access_token);
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;

        processQueue(null);
        isRefreshing = false;

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(error);
        isRefreshing = false;
        await logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
