import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { type UserRole } from '@/types/user';

/**
 * Internal (AMG staff) roles.
 * Source of truth: backend/app/models/enums.py — INTERNAL_ROLES
 */
const INTERNAL_ROLES: UserRole[] = [
  'managing_director',
  'relationship_manager',
  'coordinator',
  'finance_compliance',
];

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: string;
}

interface MFAPendingState {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isHydrated: boolean;
  mfaPending: MFAPendingState | null;
  pendingCredentials: { email: string; password: string } | null;
  setAuth: (token: string, refreshToken: string, user: AuthUser) => Promise<void>;
  setTokens: (token: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  hydrate: () => Promise<void>;
  isAuthenticated: () => boolean;
  isClient: () => boolean;
  isPartner: () => boolean;
  isInternal: () => boolean;
  setMfaPending: (state: MFAPendingState) => void;
  clearMfaPending: () => void;
  setPendingCredentials: (credentials: { email: string; password: string } | null) => void;
}

const TOKEN_KEY = 'amg_auth_token';
const REFRESH_TOKEN_KEY = 'amg_refresh_token';
const USER_KEY = 'amg_auth_user';

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  isHydrated: false,
  mfaPending: null,
  pendingCredentials: null,

  setAuth: async (token: string, refreshToken: string, user: AuthUser) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ token, refreshToken, user });
  },

  setTokens: async (token: string, refreshToken: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    set({ token, refreshToken });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ token: null, refreshToken: null, user: null, mfaPending: null, pendingCredentials: null });
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      const user = userJson ? (JSON.parse(userJson) as AuthUser) : null;
      set({ token, refreshToken, user, isHydrated: true });
    } catch {
      set({ token: null, refreshToken: null, user: null, isHydrated: true });
    }
  },

  isAuthenticated: () => {
    return get().token !== null;
  },

  isClient: () => {
    return get().user?.role === 'client';
  },

  isPartner: () => {
    return get().user?.role === 'partner';
  },

  isInternal: () => {
    const role = get().user?.role;
    return role !== undefined && INTERNAL_ROLES.includes(role);
  },

  setMfaPending: (state: MFAPendingState) => {
    set({ mfaPending: state });
  },

  clearMfaPending: () => {
    set({ mfaPending: null });
  },

  setPendingCredentials: (credentials: { email: string; password: string } | null) => {
    set({ pendingCredentials: credentials });
  },
}));
