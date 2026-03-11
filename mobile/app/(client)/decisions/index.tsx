import { useState, useCallback } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { CheckSquare } from 'lucide-react-native';

import { useDecisions } from '@/hooks/use-client-decisions';
import { DecisionCard } from '@/components/decisions/decision-card';
import { LoadingSkeleton } from '@/components/layout/loading-skeleton';
import { EmptyState } from '@/components/layout/empty-state';
import { cn } from '@/lib/utils';
import type { DecisionRequestStatus } from '@/types/decision';

type FilterTab = 'pending' | 'responded' | 'expired';

const FILTER_TABS: { key: FilterTab; label: string; status: DecisionRequestStatus }[] = [
  { key: 'pending', label: 'Pending', status: 'pending' },
  { key: 'responded', label: 'Responded', status: 'responded' },
  { key: 'expired', label: 'Expired', status: 'expired' },
];

function ListSkeleton() {
  return (
    <View className="p-4">
      {[1, 2, 3].map((i) => (
        <View key={i} className="mb-3 rounded-xl border border-border bg-card p-4">
          <LoadingSkeleton height={18} width="70%" />
          <View className="mt-2">
            <LoadingSkeleton height={14} width="90%" />
          </View>
          <View className="mt-2">
            <LoadingSkeleton height={14} width="40%" />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function DecisionsListScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');

  const statusFilter = FILTER_TABS.find((t) => t.key === activeTab)?.status;
  const { data, isLoading, isRefetching, refetch } = useDecisions(statusFilter);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      {/* Filter Tabs */}
      <View className="flex-row mx-4 mt-3 mb-3 rounded-lg bg-muted p-1">
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
      ) : !data?.decisions.length ? (
        <EmptyState
          icon={CheckSquare}
          title="No decisions"
          description={
            activeTab === 'pending'
              ? 'You have no pending decisions at this time.'
              : `No ${activeTab} decisions found.`
          }
        />
      ) : (
        <FlashList
          data={data.decisions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="px-4 mb-3">
              <DecisionCard
                decision={item}
                onPress={() => router.push(`/(client)/decisions/${item.id}`)}
              />
            </View>
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
