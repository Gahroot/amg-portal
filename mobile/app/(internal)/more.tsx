import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Bell, User as UserIcon, Shield, ChevronRight } from 'lucide-react-native';

import { useAuthStore } from '@/lib/auth-store';

type MenuItem = {
  label: string;
  icon: typeof Shield;
  description: string;
  href: Href;
};

const MENU_ITEMS: readonly MenuItem[] = [
  { label: 'Profile', icon: UserIcon, description: 'View your AMG account', href: '/(internal)/profile' },
  { label: 'Notifications', icon: Bell, description: 'Notification preferences', href: '/settings/notifications' },
  { label: 'Security', icon: Shield, description: 'Biometrics, sessions, MFA', href: '/settings/security' },
] as const;

export default function InternalMoreScreen() {
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);

  const handleLogout = async () => {
    await clearAuth();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView className="flex-1 p-4">
        <View className="mb-6 rounded-lg bg-card p-4">
          <Text className="text-lg font-semibold text-foreground">{user?.full_name}</Text>
          <Text className="text-sm text-muted-foreground">{user?.email}</Text>
          <Text className="mt-1 text-xs capitalize text-accent">{user?.role?.replace('_', ' ')}</Text>
        </View>

        {MENU_ITEMS.map((item) => (
          <Pressable
            key={item.label}
            onPress={() => router.push(item.href)}
            className="mb-2 flex-row items-center rounded-lg bg-card p-4"
          >
            <item.icon color="#64748b" size={22} />
            <View className="ml-3 flex-1">
              <Text className="text-base font-medium text-foreground">{item.label}</Text>
              <Text className="text-sm text-muted-foreground">{item.description}</Text>
            </View>
            <ChevronRight color="#64748b" size={18} />
          </Pressable>
        ))}

        <Pressable
          onPress={handleLogout}
          className="mt-6 rounded-lg bg-destructive py-3"
        >
          <Text className="text-center text-base font-semibold text-destructive-foreground">Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
