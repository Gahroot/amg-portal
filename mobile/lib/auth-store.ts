import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

export type UserRole =
  | 'managing_director'
  | 'relationship_manager'
  | 'coordinator'
  | 'finance_compliance'
  | 'client'
  | 'partner';

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

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isHydrated: boolean;
  mfaPending: boolean;
  pendingCredentials: { email: string; password: string } | null;
  setAuth: (token: string, refreshToken: string, user: AuthUser) => Promise<void>;
  clearAuth: () => Promise<void>;
  hydrate: () => Promise<void>;
  setMfaPending: (email: string, password: string) => void;
  clearMfaPending: () => void;
  isAuthenticated: () => boolean;
  isClient: () => boolean;
  isPartner: () => boolean;
  isInternal: () => boolean;
}

const TOKEN_KEY = 'amg_auth_token';
const REFRESH_TOKEN_KEY = 'amg_refresh_token';
const USER_KEY = 'amg_auth_user';

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  isHydrated: false,
  mfaPending: false,
  pendingCredentials: null,

  setAuth: async (token: string, refreshToken: string, user: AuthUser) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ token, refreshToken, user, mfaPending: false, pendingCredentials: null });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ token: null, refreshToken: null, user: null, mfaPending: false, pendingCredentials: null });
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const refreshTokenVal = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      const user = userJson ? (JSON.parse(userJson) as AuthUser) : null;
      set({ token, refreshToken: refreshTokenVal, user, isHydrated: true });
    } catch {
      set({ token: null, refreshToken: null, user: null, isHydrated: true });
    }
  },

  setMfaPending: (email: string, password: string) => {
    set({ mfaPending: true, pendingCredentials: { email, password } });
  },

  clearMfaPending: () => {
    set({ mfaPending: false, pendingCredentials: null });
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
}));
