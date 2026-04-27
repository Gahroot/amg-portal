import { Tabs, router } from 'expo-router';
import { ClipboardList, FileCheck, MessageSquare, User } from 'lucide-react-native';

import { useAuthStore } from '@/lib/auth-store';

export default function PartnerLayout() {
  const user = useAuthStore((state) => state.user);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  if (!isHydrated) return null;

  if (!user || user.role !== 'partner') {
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
          title: 'Assignments',
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="deliverables"
        options={{
          title: 'Deliverables',
          tabBarIcon: ({ color, size }) => <FileCheck color={color} size={size} />,
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
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
