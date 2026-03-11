import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import { cn } from '@/lib/utils';

interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  className?: string;
}

export function ScreenHeader({ title, showBack = false, rightAction, className }: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View className={cn('flex-row items-center justify-between px-4 py-3', className)}>
      <View className="flex-row items-center">
        {showBack ? (
          <Pressable onPress={() => router.back()} className="mr-3 p-1">
            <ArrowLeft color="#f8fafc" size={24} />
          </Pressable>
        ) : null}
        <Text className="text-xl font-bold text-primary-foreground">{title}</Text>
      </View>
      {rightAction ? <View>{rightAction}</View> : null}
    </View>
  );
}
