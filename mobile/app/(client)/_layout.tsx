import { Tabs } from 'expo-router';
import { Home, BookOpen, CheckSquare, Settings } from 'lucide-react-native';

import { usePendingDecisionsCount } from '@/hooks/use-client-decisions';

function DecisionsBadge() {
  const { data: count } = usePendingDecisionsCount();
  return count && count > 0 ? count : undefined;
}

export default function ClientLayout() {
  const badgeCount = DecisionsBadge();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#eab308',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="programs"
        options={{
          title: 'Programs',
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="decisions"
        options={{
          title: 'Decisions',
          tabBarIcon: ({ color, size }) => <CheckSquare color={color} size={size} />,
          tabBarBadge: badgeCount,
          tabBarBadgeStyle: badgeCount ? { backgroundColor: '#ef4444' } : undefined,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
      {/* Hide these from tab bar */}
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="reports" options={{ href: null }} />
    </Tabs>
  );
}
