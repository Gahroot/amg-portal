import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
} from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { format, formatDistanceToNow } from 'date-fns';

import { useProgram, useInvalidatePrograms } from '@/hooks/use-client-programs';
import { RAGBadge } from '@/components/status/rag-badge';
import { ProgramStatusBadge } from '@/components/status/program-status-badge';
import { LoadingSkeleton } from '@/components/layout/loading-skeleton';
import { cn } from '@/lib/utils';
import type { Milestone, MilestoneStatus } from '@/types/program';

const MILESTONE_ICONS: Record<MilestoneStatus, { icon: typeof CheckCircle; color: string }> = {
  completed: { icon: CheckCircle, color: '#22c55e' },
  in_progress: { icon: Clock, color: '#eab308' },
  pending: { icon: Clock, color: '#94a3b8' },
  cancelled: { icon: AlertCircle, color: '#64748b' },
};

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? completed / total : 0;
  const progress = useSharedValue(0);
  progress.value = withTiming(pct, { duration: 600 });

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View className="mt-2">
      <View className="flex-row justify-between mb-1">
        <Text className="text-xs text-muted-foreground">Progress</Text>
        <Text className="text-xs font-medium text-foreground">{Math.round(pct * 100)}%</Text>
      </View>
      <View className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <Animated.View className="h-full rounded-full bg-accent" style={barStyle} />
      </View>
    </View>
  );
}

function AccordionSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View className="mb-3 rounded-xl border border-border bg-card overflow-hidden">
      <Pressable
        onPress={() => setOpen(!open)}
        className="flex-row items-center justify-between px-4 py-3"
      >
        <Text className="text-base font-semibold text-foreground">{title}</Text>
        {open ? (
          <ChevronUp color="#64748b" size={20} />
        ) : (
          <ChevronDown color="#64748b" size={20} />
        )}
      </Pressable>
      {open ? <View className="px-4 pb-4">{children}</View> : null}
    </View>
  );
}

function MilestoneItem({
  milestone,
  onPress,
}: {
  milestone: Milestone;
  onPress: () => void;
}) {
  const config = MILESTONE_ICONS[milestone.status];
  const Icon = config.icon;

  return (
    <Pressable onPress={onPress}>
      <View className="flex-row items-center py-2.5 border-b border-border last:border-b-0">
        <Icon color={config.color} size={18} />
        <View className="ml-3 flex-1">
          <Text className="text-sm font-medium text-foreground">{milestone.title}</Text>
          {milestone.due_date ? (
            <Text className="text-xs text-muted-foreground">
              Due {format(new Date(milestone.due_date), 'MMM d, yyyy')}
            </Text>
          ) : null}
        </View>
        <View
          className={cn(
            'rounded-full px-2 py-0.5',
            milestone.status === 'completed'
              ? 'bg-green-100'
              : milestone.status === 'in_progress'
                ? 'bg-yellow-100'
                : 'bg-gray-100',
          )}
        >
          <Text
            className={cn(
              'text-xs font-medium',
              milestone.status === 'completed'
                ? 'text-green-700'
                : milestone.status === 'in_progress'
                  ? 'text-yellow-700'
                  : 'text-gray-600',
            )}
          >
            {milestone.status.replace('_', ' ')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function DetailSkeleton() {
  return (
    <View className="p-4">
      <LoadingSkeleton height={28} width="60%" className="mb-3" />
      <LoadingSkeleton height={16} width="40%" className="mb-6" />
      <LoadingSkeleton height={100} className="mb-3" />
      <LoadingSkeleton height={100} className="mb-3" />
    </View>
  );
}

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const invalidate = useInvalidatePrograms();
  const { data: program, isLoading, isRefetching, refetch } = useProgram(id ?? '');

  const handleRefresh = useCallback(() => {
    invalidate();
    refetch();
  }, [invalidate, refetch]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <DetailSkeleton />
      </SafeAreaView>
    );
  }

  if (!program) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <Text className="text-lg text-muted-foreground">Program not found</Text>
      </SafeAreaView>
    );
  }

  const sortedMilestones = [...(program.milestones ?? [])].sort((a, b) => a.position - b.position);
  const approvedDeliverables = sortedMilestones.flatMap((m) =>
    m.tasks.flatMap(() => []),
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-2xl font-bold text-foreground">{program.title}</Text>
          <View className="mt-2 flex-row items-center gap-2">
            <ProgramStatusBadge status={program.status} />
            <RAGBadge status={program.rag_status} />
          </View>
          <ProgressBar
            completed={program.completed_milestone_count}
            total={program.milestone_count}
          />
        </View>

        {/* Summary Link */}
        <Pressable
          onPress={() => router.push(`/(client)/programs/${id}/summary`)}
          className="mx-4 mt-3 mb-4 flex-row items-center rounded-lg bg-accent/10 px-4 py-3"
        >
          <FileText color="#eab308" size={18} />
          <Text className="ml-2 flex-1 text-sm font-medium text-foreground">
            View Curated Summary
          </Text>
        </Pressable>

        {/* Overview Section */}
        <View className="px-4">
          <AccordionSection title="Overview" defaultOpen>
            {program.objectives ? (
              <View className="mb-3">
                <Text className="text-xs font-medium text-muted-foreground mb-1">Objectives</Text>
                <Text className="text-sm text-foreground">{program.objectives}</Text>
              </View>
            ) : null}

            <View className="flex-row gap-4">
              {program.start_date ? (
                <View className="flex-1">
                  <Text className="text-xs font-medium text-muted-foreground mb-0.5">Start</Text>
                  <View className="flex-row items-center">
                    <Calendar color="#64748b" size={14} />
                    <Text className="ml-1 text-sm text-foreground">
                      {format(new Date(program.start_date), 'MMM d, yyyy')}
                    </Text>
                  </View>
                </View>
              ) : null}
              {program.end_date ? (
                <View className="flex-1">
                  <Text className="text-xs font-medium text-muted-foreground mb-0.5">End</Text>
                  <View className="flex-row items-center">
                    <Calendar color="#64748b" size={14} />
                    <Text className="ml-1 text-sm text-foreground">
                      {format(new Date(program.end_date), 'MMM d, yyyy')}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          </AccordionSection>

          {/* Milestones Section */}
          <AccordionSection title={`Milestones (${sortedMilestones.length})`} defaultOpen>
            {sortedMilestones.length > 0 ? (
              sortedMilestones.map((milestone) => (
                <MilestoneItem
                  key={milestone.id}
                  milestone={milestone}
                  onPress={() =>
                    router.push(
                      `/(client)/programs/${id}/milestone/${milestone.id}`,
                    )
                  }
                />
              ))
            ) : (
              <Text className="text-sm text-muted-foreground">No milestones defined yet.</Text>
            )}
          </AccordionSection>

          {/* Deliverables Section — only client-visible approved ones */}
          <AccordionSection title="Deliverables">
            <Text className="text-sm text-muted-foreground">
              Approved deliverables will appear here once completed.
            </Text>
          </AccordionSection>

          {/* Recent Updates */}
          <AccordionSection title="Recent Updates">
            <Text className="text-sm text-muted-foreground">
              Updates from your relationship manager will appear here.
            </Text>
          </AccordionSection>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
