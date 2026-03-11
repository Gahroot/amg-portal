import { useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Calendar, DollarSign, Target, ChevronRight, BookOpen, TrendingUp } from 'lucide-react-native';

import { listPrograms } from '@/lib/api/programs';
import { SearchInput } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/layout/empty-state';
import { LoadingList } from '@/components/layout/loading-skeleton';
import { RAGBadge } from '@/components/status/rag-badge';
import { ProgramStatusBadge } from '@/components/status/program-status-badge';
import type { Program, ProgramStatus } from '@/types/program';
import { format } from 'date-fns';

const STATUS_FILTERS: { value: ProgramStatus | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'design', label: 'Design' },
  { value: 'intake', label: 'Intake' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
];

export default function InternalProgramsScreen() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProgramStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['programs', { search, statusFilter }],
    queryFn: () => listPrograms({ search, status: statusFilter ?? undefined, limit: 50 }),
  });

  const programs = data?.programs ?? [];

  const filteredPrograms = programs.filter((program) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      program.title.toLowerCase().includes(searchLower) ||
      program.client_name.toLowerCase().includes(searchLower)
    );
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'Not set';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not set';
    return format(new Date(dateStr), 'MMM d, yyyy');
  };

  const getProgressPercentage = (program: Program) => {
    if (program.milestone_count === 0) return 0;
    return Math.round((program.completed_milestone_count / program.milestone_count) * 100);
  };

  const renderProgram = ({ item }: { item: Program }) => {
    const progress = getProgressPercentage(item);
    
    return (
      <Card className="mb-3">
        <Pressable className="flex-row items-start">
          <View className="flex-1">
            {/* Header Row */}
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-2">
                <Text className="text-base font-semibold text-foreground" numberOfLines={2}>
                  {item.title}
                </Text>
                <Text className="mt-0.5 text-sm text-muted-foreground">{item.client_name}</Text>
              </View>
              <ChevronRight color="#94a3b8" size={20} />
            </View>

            {/* Status Row */}
            <View className="mt-3 flex-row items-center gap-2">
              <ProgramStatusBadge status={item.status} />
              <RAGBadge status={item.rag_status} />
            </View>

            {/* Progress Bar */}
            <View className="mt-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">Milestones</Text>
                <Text className="text-xs font-medium text-foreground">
                  {item.completed_milestone_count}/{item.milestone_count}
                </Text>
              </View>
              <View className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                <View
                  className={`h-full rounded-full ${
                    progress >= 100 ? 'bg-green-500' : progress >= 50 ? 'bg-accent' : 'bg-blue-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </View>
            </View>

            {/* Details Row */}
            <View className="mt-3 flex-row flex-wrap gap-4">
              {item.budget_envelope && (
                <View className="flex-row items-center gap-1">
                  <DollarSign color="#94a3b8" size={14} />
                  <Text className="text-sm text-muted-foreground">{formatCurrency(item.budget_envelope)}</Text>
                </View>
              )}
              {item.start_date && (
                <View className="flex-row items-center gap-1">
                  <Calendar color="#94a3b8" size={14} />
                  <Text className="text-sm text-muted-foreground">{formatDate(item.start_date)}</Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      </Card>
    );
  };

  // Stats Summary
  const stats = {
    total: programs.length,
    active: programs.filter((p) => p.status === 'active').length,
    atRisk: programs.filter((p) => p.rag_status === 'red' || p.rag_status === 'amber').length,
    completed: programs.filter((p) => p.status === 'completed').length,
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <View className="p-4">
          <LoadingList count={3} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="flex-1">
        {/* Search and Filter Header */}
        <View className="gap-3 p-4 pb-2">
          <SearchInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search programs..."
          />

          {/* Status Filter Pills */}
          <View className="flex-row gap-2 overflow-x-auto pb-2">
            {STATUS_FILTERS.map((filter) => (
              <Pressable
                key={filter.label}
                onPress={() => setStatusFilter(filter.value)}
                className={`rounded-full px-3 py-1.5 ${
                  statusFilter === filter.value ? 'bg-primary' : 'bg-secondary'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    statusFilter === filter.value ? 'text-primary-foreground' : 'text-secondary-foreground'
                  }`}
                >
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Quick Stats */}
          <View className="flex-row gap-2 py-2">
            <View className="flex-1 rounded-lg bg-card p-3">
              <Text className="text-2xl font-bold text-foreground">{stats.active}</Text>
              <Text className="text-xs text-muted-foreground">Active</Text>
            </View>
            <View className="flex-1 rounded-lg bg-card p-3">
              <Text className="text-2xl font-bold text-rag-amber">{stats.atRisk}</Text>
              <Text className="text-xs text-muted-foreground">At Risk</Text>
            </View>
            <View className="flex-1 rounded-lg bg-card p-3">
              <Text className="text-2xl font-bold text-green-600">{stats.completed}</Text>
              <Text className="text-xs text-muted-foreground">Completed</Text>
            </View>
          </View>
        </View>

        {/* Programs List */}
        <FlatList
          data={filteredPrograms}
          keyExtractor={(item) => item.id}
          renderItem={renderProgram}
          contentContainerClassName="px-4 pb-4"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListHeaderComponent={
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-sm text-muted-foreground">
                {filteredPrograms.length} program{filteredPrograms.length !== 1 ? 's' : ''}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon={BookOpen}
              title="No Programs Found"
              description={search ? 'Try adjusting your search or filters.' : 'No programs have been created yet.'}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}
