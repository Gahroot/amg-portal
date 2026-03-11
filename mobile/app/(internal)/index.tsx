import { View, Text, Pressable, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Users,
  BookOpen,
  AlertTriangle,
  TrendingUp,
  Calendar,
  ArrowRight,
} from 'lucide-react-native';

import { listClients } from '@/lib/api/clients';
import { listPrograms } from '@/lib/api/programs';
import { Card } from '@/components/ui/card';
import { RAGBadge } from '@/components/status/rag-badge';
import { ProgramStatusBadge } from '@/components/status/program-status-badge';
import { LoadingList } from '@/components/layout/loading-skeleton';
import type { Program } from '@/types/program';
import { parseISO } from 'date-fns';

export default function InternalDashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data: clientsData, isLoading: clientsLoading, refetch: refetchClients } = useQuery({
    queryKey: ['clients', 'dashboard'],
    queryFn: () => listClients({ limit: 5 }),
  });

  const { data: programsData, isLoading: programsLoading, refetch: refetchPrograms } = useQuery({
    queryKey: ['programs', 'dashboard'],
    queryFn: () => listPrograms({ limit: 10 }),
  });

  const clients = clientsData?.profiles ?? [];
  const programs = programsData?.programs ?? [];

  const isLoading = clientsLoading || programsLoading;

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchClients(), refetchPrograms()]);
    setRefreshing(false);
  };

  // Calculate stats
  const stats = {
    totalClients: clientsData?.total ?? 0,
    activePrograms: programs.filter((p) => p.status === 'active').length,
    atRiskPrograms: programs.filter((p) => p.rag_status === 'red' || p.rag_status === 'amber').length,
    upcomingDeadlines: programs.filter((p) => {
      if (!p.end_date) return false;
      const date = parseISO(p.end_date);
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      return date <= weekFromNow && p.status === 'active';
    }).length,
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
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View className="p-4">
          {/* Welcome Header */}
          <View className="mb-4">
            <Text className="text-2xl font-bold text-foreground">Dashboard</Text>
            <Text className="text-muted-foreground">Overview of programs, clients, and escalations.</Text>
          </View>

          {/* Stats Cards */}
          <View className="mb-4 flex-row flex-wrap gap-3">
            <Card className="flex-1 min-w-[45%]">
              <View className="flex-row items-center gap-2">
                <View className="rounded-lg bg-blue-100 p-2">
                  <Users color="#3b82f6" size={20} />
                </View>
                <View>
                  <Text className="text-2xl font-bold text-foreground">{stats.totalClients}</Text>
                  <Text className="text-xs text-muted-foreground">Total Clients</Text>
                </View>
              </View>
            </Card>

            <Card className="flex-1 min-w-[45%]">
              <View className="flex-row items-center gap-2">
                <View className="rounded-lg bg-green-100 p-2">
                  <BookOpen color="#22c55e" size={20} />
                </View>
                <View>
                  <Text className="text-2xl font-bold text-foreground">{stats.activePrograms}</Text>
                  <Text className="text-xs text-muted-foreground">Active Programs</Text>
                </View>
              </View>
            </Card>

            <Card className="flex-1 min-w-[45%]">
              <View className="flex-row items-center gap-2">
                <View className="rounded-lg bg-orange-100 p-2">
                  <AlertTriangle color="#f97316" size={20} />
                </View>
                <View>
                  <Text className="text-2xl font-bold text-rag-amber">{stats.atRiskPrograms}</Text>
                  <Text className="text-xs text-muted-foreground">At Risk</Text>
                </View>
              </View>
            </Card>

            <Card className="flex-1 min-w-[45%]">
              <View className="flex-row items-center gap-2">
                <View className="rounded-lg bg-purple-100 p-2">
                  <Calendar color="#a855f7" size={20} />
                </View>
                <View>
                  <Text className="text-2xl font-bold text-foreground">{stats.upcomingDeadlines}</Text>
                  <Text className="text-xs text-muted-foreground">Due This Week</Text>
                </View>
              </View>
            </Card>
          </View>

          {/* Active Programs */}
          <View className="mb-4">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-foreground">Active Programs</Text>
              <Pressable className="flex-row items-center gap-1">
                <Text className="text-sm text-accent">View All</Text>
                <ArrowRight color="#eab308" size={14} />
              </Pressable>
            </View>

            {programs
              .filter((p) => p.status === 'active')
              .slice(0, 3)
              .map((program) => (
                <ProgramCard key={program.id} program={program} />
              ))}

            {programs.filter((p) => p.status === 'active').length === 0 && (
              <Card>
                <View className="items-center py-4">
                  <BookOpen color="#94a3b8" size={32} />
                  <Text className="mt-2 text-sm text-muted-foreground">No active programs</Text>
                </View>
              </Card>
            )}
          </View>

          {/* At Risk Programs */}
          {stats.atRiskPrograms > 0 && (
            <View className="mb-4">
              <View className="mb-2 flex-row items-center gap-2">
                <AlertTriangle color="#f97316" size={18} />
                <Text className="text-lg font-semibold text-foreground">At Risk Programs</Text>
              </View>

              {programs
                .filter((p) => p.rag_status === 'red' || p.rag_status === 'amber')
                .slice(0, 2)
                .map((program) => (
                  <ProgramCard key={program.id} program={program} highlightRisk />
                ))}
            </View>
          )}

          {/* Recent Clients */}
          <View className="mb-4">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-foreground">Recent Clients</Text>
              <Pressable className="flex-row items-center gap-1">
                <Text className="text-sm text-accent">View All</Text>
                <ArrowRight color="#eab308" size={14} />
              </Pressable>
            </View>

            {clients.slice(0, 3).map((client) => (
              <Card key={client.id} className="mb-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-medium text-foreground">
                      {client.display_name || client.legal_name}
                    </Text>
                    <Text className="text-sm text-muted-foreground">{client.primary_email}</Text>
                  </View>
                  <ArrowRight color="#94a3b8" size={16} />
                </View>
              </Card>
            ))}

            {clients.length === 0 && (
              <Card>
                <View className="items-center py-4">
                  <Users color="#94a3b8" size={32} />
                  <Text className="mt-2 text-sm text-muted-foreground">No clients yet</Text>
                </View>
              </Card>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProgramCard({ program, highlightRisk = false }: { program: Program; highlightRisk?: boolean }) {
  const progress =
    program.milestone_count > 0
      ? Math.round((program.completed_milestone_count / program.milestone_count) * 100)
      : 0;

  return (
    <Card className={`mb-2 ${highlightRisk && program.rag_status === 'red' ? 'border-rag-red' : ''}`}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
            {program.title}
          </Text>
          <Text className="text-sm text-muted-foreground">{program.client_name}</Text>
        </View>
        <RAGBadge status={program.rag_status} />
      </View>

      <View className="mt-3">
        <View className="flex-row items-center justify-between">
          <ProgramStatusBadge status={program.status} />
          <Text className="text-xs text-muted-foreground">
            {program.completed_milestone_count}/{program.milestone_count} milestones
          </Text>
        </View>
        <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
          <View
            className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : 'bg-accent'}`}
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>
    </Card>
  );
}
