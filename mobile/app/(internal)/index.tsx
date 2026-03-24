import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useRouter } from 'expo-router';

import { listClients } from '@/lib/api/clients';
import { listPrograms } from '@/lib/api/programs';
import { useAuthStore } from '@/lib/auth-store';
import type { Program } from '@/types/program';

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

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 16,
        margin: 4,
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: '700', color }}>{value}</Text>
      <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function ProgramRow({ program, onPress }: { program: Program; onPress: () => void }) {
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
        marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#f8fafc' }} numberOfLines={1}>
            {program.title}
          </Text>
          <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{program.client_name}</Text>
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

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
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
        <Text style={{ fontSize: 12, color: '#64748b' }}>
          {program.completed_milestone_count}/{program.milestone_count} milestones
        </Text>
      </View>

      <View
        style={{
          height: 4,
          backgroundColor: '#0f172a',
          borderRadius: 2,
          marginTop: 10,
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
    </Pressable>
  );
}

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data: clientsData, isLoading: clientsLoading, refetch: refetchClients } = useQuery({
    queryKey: ['clients', 'dashboard'],
    queryFn: () => listClients({ limit: 5 }),
  });

  const { data: programsData, isLoading: programsLoading, refetch: refetchPrograms } = useQuery({
    queryKey: ['programs', 'dashboard'],
    queryFn: () => listPrograms({ limit: 20 }),
  });

  const clients = clientsData?.profiles ?? [];
  const programs = programsData?.programs ?? [];
  const isLoading = clientsLoading || programsLoading;

  const stats = {
    totalClients: clientsData?.total ?? 0,
    activePrograms: programs.filter((p) => p.status === 'active').length,
    atRiskPrograms: programs.filter((p) => p.rag_status === 'red' || p.rag_status === 'amber').length,
    completed: programs.filter((p) => p.status === 'completed').length,
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchClients(), refetchPrograms()]);
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }} edges={['bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#eab308" />
          <Text style={{ color: '#64748b', marginTop: 12 }}>Loading dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }} edges={['bottom']}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#eab308" />
        }
      >
        <View style={{ padding: 16 }}>
          {/* Welcome Header */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#f8fafc' }}>
              Hello, {user?.full_name?.split(' ')[0] ?? 'there'} 👋
            </Text>
            <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
              Here's your portfolio overview.
            </Text>
          </View>

          {/* Stats Grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginBottom: 20 }}>
            <StatCard label="Total Clients" value={stats.totalClients} color="#3b82f6" />
            <StatCard label="Active Programs" value={stats.activePrograms} color="#22c55e" />
            <StatCard label="At Risk" value={stats.atRiskPrograms} color="#f59e0b" />
            <StatCard label="Completed" value={stats.completed} color="#64748b" />
          </View>

          {/* Active Programs */}
          <View style={{ marginBottom: 20 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '600', color: '#f8fafc' }}>Active Programs</Text>
              <Pressable onPress={() => router.push('/(internal)/programs')}>
                <Text style={{ fontSize: 13, color: '#eab308' }}>View All →</Text>
              </Pressable>
            </View>

            {programs.filter((p) => p.status === 'active').length === 0 ? (
              <View
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: 12,
                  padding: 32,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 32 }}>📋</Text>
                <Text style={{ color: '#64748b', marginTop: 8 }}>No active programs</Text>
              </View>
            ) : (
              programs
                .filter((p) => p.status === 'active')
                .slice(0, 5)
                .map((program) => (
                  <ProgramRow
                    key={program.id}
                    program={program}
                    onPress={() => router.push(`/(internal)/programs/${program.id}`)}
                  />
                ))
            )}
          </View>

          {/* Recent Clients */}
          <View style={{ marginBottom: 20 }}>
            <Text
              style={{ fontSize: 17, fontWeight: '600', color: '#f8fafc', marginBottom: 12 }}
            >
              Recent Clients
            </Text>
            {clients.length === 0 ? (
              <View
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: 12,
                  padding: 32,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 32 }}>👤</Text>
                <Text style={{ color: '#64748b', marginTop: 8 }}>No clients yet</Text>
              </View>
            ) : (
              clients.slice(0, 3).map((client) => (
                <View
                  key={client.id}
                  style={{
                    backgroundColor: '#1e293b',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '500', color: '#f8fafc' }}>
                      {client.display_name || client.legal_name}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                      {client.primary_email}
                    </Text>
                  </View>
                  <Text style={{ color: '#64748b', fontSize: 18 }}>›</Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
