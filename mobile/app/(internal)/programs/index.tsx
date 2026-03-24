import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { listPrograms } from '@/lib/api/programs';
import type { Program, ProgramStatus } from '@/types/program';

const RAG_COLORS: Record<string, string> = {
  red: '#ef4444',
  amber: '#f59e0b',
  green: '#22c55e',
};

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  design: '#3b82f6',
  intake: '#a855f7',
  on_hold: '#f59e0b',
  completed: '#64748b',
  closed: '#94a3b8',
  archived: '#cbd5e1',
};

const STATUS_FILTERS: { value: ProgramStatus | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'design', label: 'Design' },
  { value: 'intake', label: 'Intake' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
];

function ProgramCard({ program, onPress }: { program: Program; onPress: () => void }) {
  const progress =
    program.milestone_count > 0
      ? Math.round((program.completed_milestone_count / program.milestone_count) * 100)
      : 0;

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 16,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#f8fafc' }} numberOfLines={2}>
            {program.title}
          </Text>
          <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{program.client_name}</Text>
        </View>
        <Text style={{ color: '#64748b', fontSize: 18 }}>›</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <View
          style={{
            backgroundColor: STATUS_COLORS[program.status] + '33',
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '600', color: STATUS_COLORS[program.status] }}>
            {program.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: RAG_COLORS[program.rag_status] + '33',
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '600', color: RAG_COLORS[program.rag_status] }}>
            {program.rag_status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 11, color: '#64748b' }}>Progress</Text>
          <Text style={{ fontSize: 11, fontWeight: '500', color: '#94a3b8' }}>
            {program.completed_milestone_count}/{program.milestone_count} milestones
          </Text>
        </View>
        <View
          style={{
            height: 4,
            backgroundColor: '#0f172a',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${progress}%`,
              backgroundColor: progress >= 100 ? '#22c55e' : '#eab308',
              borderRadius: 2,
            }}
          />
        </View>
      </View>

      {(program.start_date || program.budget_envelope) && (
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
          {program.budget_envelope && (
            <Text style={{ fontSize: 12, color: '#64748b' }}>
              💰{' '}
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0,
              }).format(program.budget_envelope)}
            </Text>
          )}
          {program.start_date && (
            <Text style={{ fontSize: 12, color: '#64748b' }}>
              📅 {new Date(program.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

export default function ProgramsListScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProgramStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['programs', { search, statusFilter }],
    queryFn: () => listPrograms({ search, status: statusFilter ?? undefined, limit: 50 }),
  });

  const programs = data?.programs ?? [];

  const filtered = search
    ? programs.filter((p) => {
        const q = search.toLowerCase();
        return p.title.toLowerCase().includes(q) || p.client_name.toLowerCase().includes(q);
      })
    : programs;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const stats = {
    active: programs.filter((p) => p.status === 'active').length,
    atRisk: programs.filter((p) => p.rag_status === 'red' || p.rag_status === 'amber').length,
    completed: programs.filter((p) => p.status === 'completed').length,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }} edges={['bottom']}>
      {/* Search Bar */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <View
          style={{
            backgroundColor: '#1e293b',
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#64748b', marginRight: 8 }}>🔍</Text>
          <TextInput
            style={{ flex: 1, color: '#f8fafc', fontSize: 15 }}
            placeholder="Search programs…"
            placeholderTextColor="#475569"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Text style={{ color: '#64748b', fontSize: 18 }}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Status filter pills */}
        <FlatList
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.label}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10 }}
          ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setStatusFilter(item.value)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: statusFilter === item.value ? '#eab308' : '#1e293b',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '500',
                  color: statusFilter === item.value ? '#0f172a' : '#94a3b8',
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
        />

        {/* Quick stats */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 4 }}>
          {[
            { label: 'Active', value: stats.active, color: '#22c55e' },
            { label: 'At Risk', value: stats.atRisk, color: '#f59e0b' },
            { label: 'Completed', value: stats.completed, color: '#64748b' },
          ].map(({ label, value, color }) => (
            <View
              key={label}
              style={{ flex: 1, backgroundColor: '#1e293b', borderRadius: 8, padding: 10 }}
            >
              <Text style={{ fontSize: 20, fontWeight: '700', color }}>{value}</Text>
              <Text style={{ fontSize: 11, color: '#64748b' }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#eab308" />
          <Text style={{ color: '#64748b', marginTop: 12 }}>Loading programs…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProgramCard
              program={item}
              onPress={() => router.push(`/(internal)/programs/${item.id}`)}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#eab308" />
          }
          ListHeaderComponent={
            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
              {filtered.length} program{filtered.length !== 1 ? 's' : ''}
            </Text>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Text style={{ fontSize: 40 }}>📋</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#f8fafc', marginTop: 12 }}>
                No Programs Found
              </Text>
              <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4, textAlign: 'center' }}>
                {search ? 'Try adjusting your search or filters.' : 'No programs have been created yet.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
