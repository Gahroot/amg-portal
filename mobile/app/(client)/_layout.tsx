import { Tabs, router } from 'expo-router';
import { BookOpen, MessageSquare, BarChart3, Settings } from 'lucide-react-native';

import { useAuthStore } from '@/lib/auth-store';

export default function ClientLayout() {
  const user = useAuthStore((state) => state.user);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  // Wait for SecureStore to finish loading — redirecting before hydration causes
  // a redirect loop because user is null during the async read.
  if (!isHydrated) return null;

  if (!user || user.role !== 'client') {
    router.replace('/');
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#eab308',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b' },
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f8fafc',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Programs',
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
