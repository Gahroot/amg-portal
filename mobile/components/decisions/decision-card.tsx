import { View, Text, Pressable } from 'react-native';
import { Clock, AlertTriangle } from 'lucide-react-native';
import { formatDistanceToNow, isPast } from 'date-fns';

import { cn } from '@/lib/utils';
import type { DecisionRequest } from '@/types/decision';

interface DecisionCardProps {
  decision: DecisionRequest;
  onPress?: () => void;
}

const URGENCY_STYLES = {
  overdue: { border: 'border-2 border-rag-red', bg: 'bg-card' },
  soon: { border: 'border-2 border-rag-amber', bg: 'bg-card' },
  normal: { border: 'border border-border', bg: 'bg-card' },
} as const;

function getUrgency(deadline?: string): keyof typeof URGENCY_STYLES {
  if (!deadline) return 'normal';
  const d = new Date(deadline);
  if (isPast(d)) return 'overdue';
  const daysLeft = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysLeft <= 3) return 'soon';
  return 'normal';
}

export function DecisionCard({ decision, onPress }: DecisionCardProps) {
  const urgency = decision.status === 'pending' ? getUrgency(decision.deadline_date) : 'normal';
  const styles = URGENCY_STYLES[urgency];

  return (
    <Pressable onPress={onPress}>
      <View className={cn('rounded-xl p-4', styles.bg, styles.border)}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-base font-semibold text-foreground" numberOfLines={2}>
              {decision.title}
            </Text>
            {decision.program_id ? (
              <Text className="mt-1 text-xs text-muted-foreground">
                Program related
              </Text>
            ) : null}
          </View>
          <View
            className={cn(
              'rounded-full px-2 py-0.5',
              decision.status === 'pending' ? 'bg-rag-amber/20' : 'bg-muted',
            )}
          >
            <Text
              className={cn(
                'text-xs font-medium',
                decision.status === 'pending' ? 'text-rag-amber' : 'text-muted-foreground',
              )}
            >
              {decision.status.charAt(0).toUpperCase() + decision.status.slice(1)}
            </Text>
          </View>
        </View>

        <Text className="mt-2 text-sm text-muted-foreground" numberOfLines={2}>
          {decision.prompt}
        </Text>

        {decision.deadline_date ? (
          <View className="mt-3 flex-row items-center">
            {urgency === 'overdue' ? (
              <AlertTriangle color="#ef4444" size={14} />
            ) : (
              <Clock color="#64748b" size={14} />
            )}
            <Text
              className={cn(
                'ml-1.5 text-xs font-medium',
                urgency === 'overdue' ? 'text-rag-red' : 'text-muted-foreground',
              )}
            >
              {urgency === 'overdue'
                ? `Overdue by ${formatDistanceToNow(new Date(decision.deadline_date))}`
                : `Due ${formatDistanceToNow(new Date(decision.deadline_date), { addSuffix: true })}`}
            </Text>
          </View>
        ) : null}

        <View className="mt-2">
          <Text className="text-xs text-muted-foreground">
            {decision.response_type.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
