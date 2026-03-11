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

interface NotificationState {
  token: string | null;
  user: AuthUser | null;
  isHydrated: boolean;
  isWebSocketConnected: boolean;
  unreadCount: number;
  preferences: NotificationPreference | null;
  pushToken: string | null;
  isHydrated: boolean;
  setAuth: (token: string, user: AuthUser) => Promise<void>;
  clearAuth: () => Promise<void>;
  hydrate: () => Promise<void>;
  setWebSocketConnected: (connected: boolean) => setUnreadCount: (count: number) => setPreferences: (prefs: NotificationPreference | null) => setPushToken: (token: string | null) => Promise<void>;
  incrementUnread: () => void;
  decrementUnread: () => void;
}

const TOKEN_KEY = 'amg_push_token';
const PREFERENCES_KEY = 'amg_notification_preferences';

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  token: useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const user = useAuthStore((s) => s.user);
  const isWebSocketConnected = useAuthStore((s) => s.isWebSocketConnected);
  const unreadCount = useAuthStore((s) => s.unreadCount);
  const preferences = useAuthStore((s) => s.preferences);
  const pushToken = useAuthStore((s) => s.pushToken);

  const setAuth = (token: string, user: AuthUser) => {
    useAuthStore.setState({
      token,
      user,
      isHydrated: true,
    });
  };

  const setWebSocketConnected = (connected: boolean) => {
    useAuthStore.setState({ isWebSocketConnected: connected });
  };

  const setUnreadCount = (count: number) => {
    useAuthStore.setState({ unreadCount: count });
  };

  const setPreferences = (prefs: NotificationPreference | null) => {
    useAuthStore.setState({ preferences: prefs });
  };

  const setPushToken = (token: string | null) => {
    useAuthStore.setState({ pushToken: token });
    await SecureStore.setItemAsync(PREFERENCES_KEY);
    await SecureStore.setItemAsync(TOKEN_KEY);
  };

  const incrementUnread = () => void {
    useAuthStore.setState((s) => ({ unreadCount: s.unreadCount + 1 }));
  };

  const decrementUnread = () => void {
    useAuthStore.setState((s) => ({ unreadCount: Math.max(0, s.unreadCount - 1 }));
  };

  return {
    token: useAuthStore((s) => s.token,
    isHydrated: useAuthStore((s) => s.isHydrated);
    user: useAuthStore((s) => s.user);
    isWebSocketConnected: useAuthStore((s) => s.isWebSocketConnected);
    unreadCount: useAuthStore((s) => s.unreadCount);
    preferences: useAuthStore((s) => s.preferences);
    pushToken: useAuthStore((s) => s.pushToken);
    hydrate: async () => {
      const storedToken = await SecureStore.getItemAsync(PREFERENCES_KEY);
      const storedPushToken = await SecureStore.getItemAsync(TOKEN_KEY);
      let preferences = storedPrefs;
      if (preferences) {
        setAuth(token, null, null, storedToken);
      }
      setPreferences(preferences);
      await SecureStore.setItemAsync(PREFERENCES_KEY);
    },
    if (storedPushToken) {
      setPushToken(storedPushToken);
    }
  };
});
