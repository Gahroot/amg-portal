import { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useClientPrograms, useInvalidatePrograms } from '@/hooks/use-client-programs';
import { RAGBadge } from '@/components/status/rag-badge';
import { ProgramStatusBadge } from '@/components/status/program-status-badge';
import { LoadingSkeleton } from '@/components/layout/loading-skeleton';
import { EmptyState } from '@/components/layout/empty-state';
import { cn } from '@/lib/utils';
import type { Program, ProgramStatus } from '@/types/program';
import { BookOpen } from 'lucide-react-native';

type FilterTab = 'active' | 'completed' | 'all';

const FILTER_TABS: { key: FilterTab; label: string; status?: ProgramStatus }[] = [
  { key: 'active', label: 'Active', status: 'active' },
  { key: 'completed', label: 'Completed', status: 'completed' },
  { key: 'all', label: 'All' },
];

function MilestoneProgressBar({ completed, total }: { completed: number; total: number }) {
  const progress = useSharedValue(0);
  const pct = total > 0 ? completed / total : 0;

  progress.value = withTiming(pct, { duration: 600 });

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
      <Animated.View
        className="h-full rounded-full bg-accent"
        style={barStyle}
      />
    </View>
  );
}

function ProgramCard({ program, onPress }: { program: Program; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <View className="mx-4 mb-3 rounded-xl border border-border bg-card p-4">
        <View className="flex-row items-start justify-between">
          <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={1}>
            {program.title}
          </Text>
          <RAGBadge status={program.rag_status} />
        </View>
        <View className="mt-2 flex-row items-center gap-2">
          <ProgramStatusBadge status={program.status} />
        </View>
        <MilestoneProgressBar
          completed={program.completed_milestone_count}
          total={program.milestone_count}
        />
        <Text className="mt-1.5 text-xs text-muted-foreground">
          {program.completed_milestone_count}/{program.milestone_count} milestones
        </Text>
      </View>
    </Pressable>
  );
}

function ListSkeleton() {
  return (
    <View className="p-4">
      {[1, 2, 3].map((i) => (
        <View key={i} className="mb-3 rounded-xl border border-border bg-card p-4">
          <LoadingSkeleton height={18} width="70%" />
          <View className="mt-2">
            <LoadingSkeleton height={14} width="40%" />
          </View>
          <View className="mt-3">
            <LoadingSkeleton height={8} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function ProgramsListScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>('active');
  const [search, setSearch] = useState('');
  const invalidate = useInvalidatePrograms();

  const statusFilter = FILTER_TABS.find((t) => t.key === activeTab)?.status;
  const { data, isLoading, isRefetching, refetch } = useClientPrograms({
    status: statusFilter ?? 'all',
    search,
  });

  const handleRefresh = useCallback(() => {
    invalidate();
    refetch();
  }, [invalidate, refetch]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      {/* Search Bar */}
      <View className="flex-row items-center mx-4 mt-3 mb-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search color="#64748b" size={18} />
        <TextInput
          className="ml-2 flex-1 text-sm text-foreground"
          placeholder="Search programs..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      {/* Filter Tabs */}
      <View className="flex-row mx-4 mb-3 rounded-lg bg-muted p-1">
        {FILTER_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 items-center rounded-md py-2',
              activeTab === tab.key ? 'bg-card' : '',
            )}
          >
            <Text
              className={cn(
                'text-sm font-medium',
                activeTab === tab.key ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.programs.length ? (
        <EmptyState
          icon={BookOpen}
          title="No programs found"
          description={
            activeTab === 'active'
              ? 'You have no active programs at the moment.'
              : 'No programs match your current filters.'
          }
        />
      ) : (
        <FlashList
          data={data.programs}
          keyExtractor={(item: Program) => item.id}
          renderItem={({ item }: { item: Program }) => (
            <ProgramCard
              program={item}
              onPress={() => router.push(`/(client)/programs/${item.id}`)}
            />
          )}

          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />
          }
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 16 }}
        />
      )}
    </SafeAreaView>
  );
}
