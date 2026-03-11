import { useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { AlertCircle, BookOpen, ChevronRight } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useAuthStore } from '@/lib/auth-store';
import { useClientPrograms, useInvalidatePrograms } from '@/hooks/use-client-programs';
import { usePendingDecisionsCount } from '@/hooks/use-client-decisions';
import { RAGBadge } from '@/components/status/rag-badge';
import { LoadingSkeleton } from '@/components/layout/loading-skeleton';
import { EmptyState } from '@/components/layout/empty-state';
import { cn } from '@/lib/utils';
import type { Program } from '@/types/program';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function ProgramProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? completed / total : 0;
  const progress = useSharedValue(0);
  progress.value = withTiming(pct, { duration: 600 });

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <Animated.View className="h-full rounded-full bg-accent" style={barStyle} />
    </View>
  );
}

function ProgramSummaryCard({ program, onPress }: { program: Program; onPress: () => void }) {
  const nextMilestone = program.milestone_count - program.completed_milestone_count;
  const endDate = program.end_date ? new Date(program.end_date) : null;
  const daysRemaining = endDate
    ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <Pressable onPress={onPress}>
      <View className="mr-3 w-64 rounded-xl border border-border bg-card p-4">
        <View className="flex-row items-start justify-between">
          <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
            {program.title}
          </Text>
          <RAGBadge status={program.rag_status} />
        </View>
        <ProgramProgressBar
          completed={program.completed_milestone_count}
          total={program.milestone_count}
        />
        <View className="mt-2 flex-row justify-between">
          <Text className="text-xs text-muted-foreground">
            {nextMilestone > 0 ? `${nextMilestone} milestones left` : 'All complete'}
          </Text>
          {daysRemaining !== null ? (
            <Text className="text-xs text-muted-foreground">
              {daysRemaining > 0 ? `${daysRemaining}d remaining` : 'Overdue'}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function DashboardSkeleton() {
  return (
    <View className="p-4">
      <LoadingSkeleton height={28} width="50%" className="mb-1" />
      <LoadingSkeleton height={16} width="30%" className="mb-6" />
      <LoadingSkeleton height={120} className="mb-4" />
      <LoadingSkeleton height={80} className="mb-4" />
      <LoadingSkeleton height={60} className="mb-2" />
      <LoadingSkeleton height={60} className="mb-2" />
      <LoadingSkeleton height={60} />
    </View>
  );
}

export default function ClientDashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const invalidate = useInvalidatePrograms();

  const { data: programsData, isLoading, isRefetching, refetch } = useClientPrograms({
    status: 'active',
  });
  const { data: pendingCount } = usePendingDecisionsCount();

  const handleRefresh = useCallback(() => {
    invalidate();
    refetch();
  }, [invalidate, refetch]);

  const firstName = user?.full_name?.split(' ')[0] ?? 'there';
  const today = format(new Date(), 'EEEE, MMMM d, yyyy');
  const programs = programsData?.programs ?? [];

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <DashboardSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Greeting */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-2xl font-bold text-foreground">
            {getGreeting()}, {firstName}
          </Text>
          <Text className="text-sm text-muted-foreground">{today}</Text>
        </View>

        {/* Pending Decisions Banner */}
        {pendingCount && pendingCount > 0 ? (
          <Pressable onPress={() => router.push('/(client)/decisions')}>
            <View className="mx-4 mt-3 flex-row items-center rounded-xl bg-rag-amber/10 border border-rag-amber/30 px-4 py-3">
              <AlertCircle color="#eab308" size={20} />
              <Text className="ml-3 flex-1 text-sm font-medium text-foreground">
                You have {pendingCount} decision{pendingCount > 1 ? 's' : ''} awaiting your response
              </Text>
              <ChevronRight color="#eab308" size={18} />
            </View>
          </Pressable>
        ) : null}

        {/* Active Programs */}
        <View className="mt-5">
          <View className="flex-row items-center justify-between px-4 mb-3">
            <Text className="text-lg font-semibold text-foreground">Active Programs</Text>
            <Pressable onPress={() => router.push('/(client)/programs')}>
              <Text className="text-sm font-medium text-accent">View All</Text>
            </Pressable>
          </View>

          {programs.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 16, paddingRight: 4 }}
            >
              {programs.map((program) => (
                <ProgramSummaryCard
                  key={program.id}
                  program={program}
                  onPress={() => router.push(`/(client)/programs/${program.id}`)}
                />
              ))}
            </ScrollView>
          ) : (
            <View className="mx-4">
              <EmptyState
                icon={BookOpen}
                title="No active programs"
                description="Your active programs will appear here once set up by your relationship manager."
              />
            </View>
          )}
        </View>

        {/* Recent Activity */}
        <View className="mt-6 px-4">
          <Text className="text-lg font-semibold text-foreground mb-3">Recent Activity</Text>
          <View className="rounded-xl border border-border bg-card p-4">
            <Text className="text-sm text-muted-foreground">
              Recent communications and updates from your relationship manager will appear here.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
