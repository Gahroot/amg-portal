import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Shield, ChevronRight, Bell, HelpCircle, LogOut, Settings } from 'lucide-react-native';

import { useAuthStore } from '@/lib/auth-store';
import { useBiometrics } from '@/hooks/use-biometrics';

const ROLE_LABELS: Record<string, string> = {
  managing_director: 'Managing Director',
  relationship_manager: 'Relationship Manager',
  coordinator: 'Coordinator',
  finance_compliance: 'Finance & Compliance',
  client: 'Client',
  partner: 'Partner',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { status: biometricStatus } = useBiometrics();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }} edges={['bottom']}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ padding: 16 }}>
          {/* Avatar + Name */}
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#eab308',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 28, fontWeight: '700', color: '#0f172a' }}>
                {user?.full_name ? getInitials(user.full_name) : '?'}
              </Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#f8fafc' }}>
              {user?.full_name}
            </Text>
            <View
              style={{
                backgroundColor: '#1e3a5f',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 4,
                marginTop: 8,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#60a5fa' }}>
                {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
              </Text>
            </View>
          </View>

          {/* Account Details */}
          <View
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 14,
              paddingHorizontal: 16,
              marginBottom: 16,
            }}
          >
            <View
              style={{
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#0f172a',
              }}
            >
              <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>Email</Text>
              <Text style={{ fontSize: 15, color: '#f8fafc' }}>{user?.email}</Text>
            </View>
            <View
              style={{
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#0f172a',
              }}
            >
              <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>Role</Text>
              <Text style={{ fontSize: 15, color: '#f8fafc' }}>
                {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
              </Text>
            </View>
            <View style={{ paddingVertical: 14 }}>
              <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>Account Status</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: user?.status === 'active' ? '#22c55e' : '#f59e0b',
                  }}
                />
                <Text style={{ fontSize: 15, color: '#f8fafc', textTransform: 'capitalize' }}>
                  {user?.status}
                </Text>
              </View>
            </View>
          </View>

          {/* Settings Section */}
          <View
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 14,
              marginBottom: 16,
              overflow: 'hidden',
            }}
          >
            {/* Security */}
            <Pressable
              onPress={() => router.push('/settings/security')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#0f172a',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Shield size={20} color="#6366f1" />
                <Text style={{ fontSize: 15, color: '#f8fafc' }}>Security</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {biometricStatus.isEnabled && (
                  <View style={{ backgroundColor: 'rgba(99, 102, 241, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 11, color: '#6366f1' }}>{biometricStatus.authType}</Text>
                  </View>
                )}
                <ChevronRight size={18} color="#64748b" />
              </View>
            </Pressable>

            {/* Notifications */}
            <Pressable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#0f172a',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Bell size={20} color="#6366f1" />
                <Text style={{ fontSize: 15, color: '#f8fafc' }}>Notifications</Text>
              </View>
              <ChevronRight size={18} color="#64748b" />
            </Pressable>

            {/* Help */}
            <Pressable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <HelpCircle size={20} color="#6366f1" />
                <Text style={{ fontSize: 15, color: '#f8fafc' }}>Help & Support</Text>
              </View>
              <ChevronRight size={18} color="#64748b" />
            </Pressable>
          </View>

          {/* App Info */}
          <View
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 14,
              paddingHorizontal: 16,
              marginBottom: 24,
            }}
          >
            <View
              style={{
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#0f172a',
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 14, color: '#94a3b8' }}>App</Text>
              <Text style={{ fontSize: 14, color: '#f8fafc' }}>AMG Portal</Text>
            </View>
            <View
              style={{
                paddingVertical: 14,
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 14, color: '#94a3b8' }}>Version</Text>
              <Text style={{ fontSize: 14, color: '#f8fafc' }}>1.0.0</Text>
            </View>
          </View>

          {/* Sign Out */}
          <Pressable
            onPress={handleLogout}
            style={{
              backgroundColor: '#7f1d1d',
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
              marginBottom: 16,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <LogOut size={18} color="#fca5a5" />
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#fca5a5' }}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
