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
  user: AuthUser | null;
  isHydrated: boolean;
  setAuth: (token: string, user: AuthUser) => Promise<void>;
  clearAuth: () => Promise<void>;
  hydrate: () => Promise<void>;
  isAuthenticated: () => boolean;
  isClient: () => boolean;
  isPartner: () => boolean;
  isInternal: () => boolean;
}

const TOKEN_KEY = 'amg_auth_token';
const USER_KEY = 'amg_auth_user';

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isHydrated: false,

  setAuth: async (token: string, user: AuthUser) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ token: null, user: null });
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      const user = userJson ? (JSON.parse(userJson) as AuthUser) : null;
      set({ token, user, isHydrated: true });
    } catch {
      set({ token: null, user: null, isHydrated: true });
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
}));
