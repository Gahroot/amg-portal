import { useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle, Clock, AlertCircle, Download, Calendar, User } from 'lucide-react-native';
import { format } from 'date-fns';

import { useProgram, useInvalidatePrograms } from '@/hooks/use-client-programs';
import { getProgramStatusReport } from '@/lib/api/reports';
import { RAGBadge } from '@/components/status/rag-badge';
import { ProgramStatusBadge } from '@/components/status/program-status-badge';
import { LoadingSkeleton } from '@/components/layout/loading-skeleton';
import { cn } from '@/lib/utils';
import type { MilestoneStatus } from '@/types/program';
import { Alert } from 'react-native';

const MILESTONE_ICONS: Record<MilestoneStatus, { icon: typeof CheckCircle; color: string }> = {
  completed: { icon: CheckCircle, color: '#22c55e' },
  in_progress: { icon: Clock, color: '#eab308' },
  pending: { icon: Clock, color: '#94a3b8' },
  cancelled: { icon: AlertCircle, color: '#64748b' },
};

export default function ProgramSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const invalidate = useInvalidatePrograms();
  const { data: program, isLoading, isRefetching, refetch } = useProgram(id ?? '');

  const handleRefresh = useCallback(() => {
    invalidate();
    refetch();
  }, [invalidate, refetch]);

  const handleDownloadPdf = useCallback(async () => {
    try {
      await getProgramStatusReport(id ?? '');
      Alert.alert('Report', 'Program status report has been requested. You will receive it shortly.');
    } catch {
      Alert.alert('Error', 'Failed to request the report. Please try again.');
    }
  }, [id]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <View className="p-4">
          <LoadingSkeleton height={28} width="60%" className="mb-3" />
          <LoadingSkeleton height={100} className="mb-3" />
          <LoadingSkeleton height={200} className="mb-3" />
        </View>
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
  const pctComplete =
    program.milestone_count > 0
      ? Math.round((program.completed_milestone_count / program.milestone_count) * 100)
      : 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <View className="px-4 pt-4 pb-3">
          <Text className="text-2xl font-bold text-foreground">{program.title}</Text>
          <View className="mt-2 flex-row items-center gap-2">
            <ProgramStatusBadge status={program.status} />
            <RAGBadge status={program.rag_status} />
          </View>
        </View>

        {/* Overview Narrative */}
        <View className="mx-4 mb-4 rounded-xl border border-border bg-card p-4">
          <Text className="text-sm font-semibold text-foreground mb-2">Program Overview</Text>
          <Text className="text-sm text-foreground leading-5">
            {program.objectives ?? 'No program summary available at this time. Your relationship manager will provide updates as the program progresses.'}
          </Text>
          {program.scope ? (
            <View className="mt-3">
              <Text className="text-xs font-medium text-muted-foreground mb-1">Scope</Text>
              <Text className="text-sm text-foreground">{program.scope}</Text>
            </View>
          ) : null}
        </View>

        {/* Visual Timeline */}
        <View className="mx-4 mb-4 rounded-xl border border-border bg-card p-4">
          <Text className="text-sm font-semibold text-foreground mb-3">Key Milestones</Text>
          {sortedMilestones.length > 0 ? (
            <View>
              {sortedMilestones.map((milestone, idx) => {
                const config = MILESTONE_ICONS[milestone.status];
                const Icon = config.icon;
                const isLast = idx === sortedMilestones.length - 1;

                return (
                  <View key={milestone.id} className="flex-row">
                    {/* Timeline connector */}
                    <View className="items-center mr-3" style={{ width: 24 }}>
                      <Icon color={config.color} size={18} />
                      {!isLast ? (
                        <View className="w-0.5 flex-1 bg-border mt-1" />
                      ) : null}
                    </View>
                    {/* Content */}
                    <View className={cn('flex-1', !isLast ? 'pb-4' : '')}>
                      <Text className="text-sm font-medium text-foreground">
                        {milestone.title}
                      </Text>
                      {milestone.due_date ? (
                        <Text className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(milestone.due_date), 'MMM d, yyyy')}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text className="text-sm text-muted-foreground">No milestones defined yet.</Text>
          )}
        </View>

        {/* Progress Summary */}
        <View className="mx-4 mb-4 rounded-xl border border-border bg-card p-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-sm font-semibold text-foreground">Overall Progress</Text>
            <Text className="text-sm font-bold text-accent">{pctComplete}%</Text>
          </View>
          <View className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <View
              className="h-full rounded-full bg-accent"
              style={{ width: `${pctComplete}%` }}
            />
          </View>
          <View className="mt-2 flex-row justify-between">
            <Text className="text-xs text-muted-foreground">
              {program.completed_milestone_count} of {program.milestone_count} milestones
            </Text>
            {program.end_date ? (
              <Text className="text-xs text-muted-foreground">
                Target: {format(new Date(program.end_date), 'MMM yyyy')}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Timeline */}
        {program.start_date || program.end_date ? (
          <View className="mx-4 mb-4 rounded-xl border border-border bg-card p-4">
            <Text className="text-sm font-semibold text-foreground mb-2">Timeline</Text>
            <View className="flex-row gap-4">
              {program.start_date ? (
                <View className="flex-1">
                  <View className="flex-row items-center mb-0.5">
                    <Calendar color="#64748b" size={14} />
                    <Text className="ml-1.5 text-xs text-muted-foreground">Start</Text>
                  </View>
                  <Text className="text-sm font-medium text-foreground">
                    {format(new Date(program.start_date), 'MMM d, yyyy')}
                  </Text>
                </View>
              ) : null}
              {program.end_date ? (
                <View className="flex-1">
                  <View className="flex-row items-center mb-0.5">
                    <Calendar color="#64748b" size={14} />
                    <Text className="ml-1.5 text-xs text-muted-foreground">Target End</Text>
                  </View>
                  <Text className="text-sm font-medium text-foreground">
                    {format(new Date(program.end_date), 'MMM d, yyyy')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Key Contact */}
        <View className="mx-4 mb-4 rounded-xl border border-border bg-card p-4">
          <View className="flex-row items-center">
            <View className="rounded-full bg-accent/20 p-2">
              <User color="#eab308" size={18} />
            </View>
            <View className="ml-3">
              <Text className="text-xs text-muted-foreground">Relationship Manager</Text>
              <Text className="text-sm font-medium text-foreground">Your dedicated RM</Text>
            </View>
          </View>
        </View>

        {/* Download PDF */}
        <View className="px-4">
          <Pressable
            onPress={handleDownloadPdf}
            className="flex-row items-center justify-center rounded-lg bg-accent py-3"
          >
            <Download color="#0f172a" size={18} />
            <Text className="ml-2 text-sm font-semibold text-accent-foreground">
              Download Program Report
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
