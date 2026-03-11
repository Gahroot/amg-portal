import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/lib/auth-store';

export default function ClientSettingsScreen() {
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);

  const handleLogout = async () => {
    await clearAuth();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="flex-1 p-4">
        <View className="mb-6 rounded-lg bg-card p-4">
          <Text className="text-lg font-semibold text-foreground">{user?.full_name}</Text>
          <Text className="text-sm text-muted-foreground">{user?.email}</Text>
        </View>
        <Pressable
          onPress={handleLogout}
          className="rounded-lg bg-destructive py-3"
        >
          <Text className="text-center text-base font-semibold text-destructive-foreground">Sign Out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
