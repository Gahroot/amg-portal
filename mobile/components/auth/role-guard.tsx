import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';

import { useAuthStore, type UserRole } from '@/lib/auth-store';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-8">
        <ShieldAlert color="#ef4444" size={48} />
        <Text className="mt-4 text-xl font-bold text-foreground">Access Denied</Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          You don't have permission to access this section.
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-6 items-center rounded-lg bg-primary px-8 py-3"
        >
          <Text className="text-sm font-semibold text-primary-foreground">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}
