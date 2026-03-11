import { View, Text } from 'react-native';

import { cn } from '@/lib/utils';
import type { ProgramStatus } from '@/types/program';

interface ProgramStatusBadgeProps {
  status: ProgramStatus;
  className?: string;
}

const STATUS_STYLES: Record<ProgramStatus, { bg: string; text: string }> = {
  intake: { bg: 'bg-blue-100', text: 'text-blue-700' },
  design: { bg: 'bg-purple-100', text: 'text-purple-700' },
  active: { bg: 'bg-green-100', text: 'text-green-700' },
  on_hold: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-700' },
  archived: { bg: 'bg-slate-100', text: 'text-slate-500' },
};

export function ProgramStatusBadge({ status, className }: ProgramStatusBadgeProps) {
  const style = STATUS_STYLES[status];
  const label = status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <View className={cn('rounded-full px-3 py-1', style.bg, className)}>
      <Text className={cn('text-xs font-semibold', style.text)}>{label}</Text>
    </View>
  );
}
