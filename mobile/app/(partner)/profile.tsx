import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Shield, ChevronRight, Bell, HelpCircle, LogOut } from 'lucide-react-native';

import { useAuthStore } from '@/lib/auth-store';
import { useBiometrics } from '@/hooks/use-biometrics';

export default function PartnerProfileScreen() {
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);
  const { status: biometricStatus } = useBiometrics();

  const handleLogout = async () => {
    await clearAuth();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* User Card */}
          <View className="mb-6 rounded-lg bg-card p-4">
            <Text className="text-lg font-semibold text-foreground">{user?.full_name}</Text>
            <Text className="text-sm text-muted-foreground">{user?.email}</Text>
          </View>

          {/* Settings Options */}
          <View className="mb-6 rounded-lg bg-card overflow-hidden">
            {/* Security */}
            <Pressable
              onPress={() => router.push('/settings/security')}
              className="flex-row items-center justify-between px-4 py-4 border-b border-border"
            >
              <View className="flex-row items-center gap-3">
                <Shield size={20} color="#6366f1" />
                <Text className="text-base text-foreground">Security</Text>
              </View>
              <View className="flex-row items-center gap-2">
                {biometricStatus.isEnabled && (
                  <View className="px-2 py-0.5 rounded bg-primary/20">
                    <Text className="text-xs text-primary">{biometricStatus.authType}</Text>
                  </View>
                )}
                <ChevronRight size={18} color="#64748b" />
              </View>
            </Pressable>

            {/* Notifications */}
            <Pressable
              onPress={() => {}}
              className="flex-row items-center justify-between px-4 py-4 border-b border-border"
            >
              <View className="flex-row items-center gap-3">
                <Bell size={20} color="#6366f1" />
                <Text className="text-base text-foreground">Notifications</Text>
              </View>
              <ChevronRight size={18} color="#64748b" />
            </Pressable>

            {/* Help */}
            <Pressable
              onPress={() => {}}
              className="flex-row items-center justify-between px-4 py-4"
            >
              <View className="flex-row items-center gap-3">
                <HelpCircle size={20} color="#6366f1" />
                <Text className="text-base text-foreground">Help & Support</Text>
              </View>
              <ChevronRight size={18} color="#64748b" />
            </Pressable>
          </View>

          {/* Sign Out */}
          <Pressable
            onPress={handleLogout}
            className="rounded-lg bg-destructive py-3 flex-row items-center justify-center gap-2"
          >
            <LogOut size={18} color="#fff" />
            <Text className="text-center text-base font-semibold text-destructive-foreground">
              Sign Out
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
