import { View, Text } from 'react-native';

import { cn } from '@/lib/utils';
import type { RAGStatus } from '@/types/program';

interface RAGBadgeProps {
  status: RAGStatus;
  className?: string;
}

const RAG_STYLES: Record<RAGStatus, { bg: string; text: string; label: string }> = {
  red: { bg: 'bg-rag-red/20', text: 'text-rag-red', label: 'Red' },
  amber: { bg: 'bg-rag-amber/20', text: 'text-rag-amber', label: 'Amber' },
  green: { bg: 'bg-rag-green/20', text: 'text-rag-green', label: 'Green' },
};

export function RAGBadge({ status, className }: RAGBadgeProps) {
  const style = RAG_STYLES[status];

  return (
    <View className={cn('rounded-full px-3 py-1', style.bg, className)}>
      <Text className={cn('text-xs font-semibold', style.text)}>{style.label}</Text>
    </View>
  );
}
