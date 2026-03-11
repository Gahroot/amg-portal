import { View, Text } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <View className={cn('flex-1 items-center justify-center p-8', className)}>
      <Icon color="#94a3b8" size={48} />
      <Text className="mt-4 text-lg font-semibold text-foreground">{title}</Text>
      <Text className="mt-2 text-center text-sm text-muted-foreground">{description}</Text>
    </View>
  );
}
