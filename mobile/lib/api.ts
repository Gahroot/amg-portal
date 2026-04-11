import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

import { API_V1_URL } from '@/lib/config';

const TOKEN_KEY = 'amg_auth_token';
const REFRESH_TOKEN_KEY = 'amg_refresh_token';

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

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync('amg_auth_user');
  router.replace('/(auth)/login');
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Extract backend error message for all errors
    if (error.response?.data?.detail) {
      error.message = error.response.data.detail;
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
