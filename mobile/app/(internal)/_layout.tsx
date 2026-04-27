import { Tabs, router } from 'expo-router';
import { LayoutDashboard, BookOpen, User, Users, CheckSquare, Handshake, MoreHorizontal } from 'lucide-react-native';

import { useAuthStore } from '@/lib/auth-store';
import { INTERNAL_ROLES } from '@/types/user';

export default function InternalLayout() {
  const user = useAuthStore((state) => state.user);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  if (!isHydrated) return null;

  if (!user || !INTERNAL_ROLES.includes(user.role)) {
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
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="programs"
        options={{
          title: 'Programs',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => <CheckSquare color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="partners"
        options={{
          title: 'Partners',
          tabBarIcon: ({ color, size }) => <Handshake color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="profile" options={{ href: null, title: 'Profile', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
