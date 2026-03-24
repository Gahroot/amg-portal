import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { getProgram } from '@/lib/api/programs';
import type { Milestone, Task } from '@/types/program';

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

const MILESTONE_COLORS: Record<string, string> = {
  pending: '#64748b',
  in_progress: '#3b82f6',
  completed: '#22c55e',
  cancelled: '#94a3b8',
};

const TASK_STATUS_COLORS: Record<string, string> = {
  todo: '#64748b',
  in_progress: '#3b82f6',
  blocked: '#ef4444',
  done: '#22c55e',
  cancelled: '#94a3b8',
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
      }}
    >
      <Text style={{ fontSize: 14, color: '#64748b' }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '500', color: '#f8fafc', maxWidth: '60%', textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const [expanded, setExpanded] = useState(false);
  const color = MILESTONE_COLORS[milestone.status] ?? '#64748b';
  const progress =
    milestone.task_count > 0
      ? Math.round((milestone.completed_task_count / milestone.task_count) * 100)
      : 0;

  return (
    <View
      style={{
        backgroundColor: '#1e293b',
        borderRadius: 10,
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={() => milestone.tasks?.length > 0 && setExpanded((e) => !e)}
        style={{ padding: 14 }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#f8fafc' }}>
              {milestone.title}
            </Text>
            {milestone.due_date && (
              <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Due {new Date(milestone.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            )}
          </View>
          <View
            style={{
              backgroundColor: color + '33',
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color }}>{milestone.status.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>

        {milestone.task_count > 0 && (
          <View style={{ marginTop: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 11, color: '#64748b' }}>Tasks</Text>
              <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                {milestone.completed_task_count}/{milestone.task_count}
              </Text>
            </View>
            <View style={{ height: 3, backgroundColor: '#0f172a', borderRadius: 2, overflow: 'hidden' }}>
              <View
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  backgroundColor: progress >= 100 ? '#22c55e' : '#eab308',
                  borderRadius: 2,
                }}
              />
            </View>
            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4, textAlign: 'right' }}>
              {expanded ? 'Hide tasks ▲' : 'Show tasks ▼'}
            </Text>
          </View>
        )}
      </Pressable>

      {expanded && milestone.tasks && milestone.tasks.length > 0 && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
          {milestone.tasks.map((task: Task) => (
            <View
              key={task.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 8,
                borderTopWidth: 1,
                borderTopColor: '#0f172a',
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: TASK_STATUS_COLORS[task.status] ?? '#64748b',
                  marginRight: 10,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: '#f8fafc' }}>{task.title}</Text>
                {task.due_date && (
                  <Text style={{ fontSize: 11, color: '#64748b' }}>
                    Due {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                )}
              </View>
              <View
                style={{
                  backgroundColor: TASK_STATUS_COLORS[task.status] + '33',
                  borderRadius: 4,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '600', color: TASK_STATUS_COLORS[task.status] }}>
                  {task.status.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

  const { data: program, isLoading, error, refetch } = useQuery({
    queryKey: ['program', id],
    queryFn: () => getProgram(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (program?.title) {
      navigation.setOptions({ title: program.title });
    }
  }, [program?.title, navigation]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }} edges={['bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#eab308" />
          <Text style={{ color: '#64748b', marginTop: 12 }}>Loading program…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !program) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }} edges={['bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 40 }}>⚠️</Text>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#f8fafc', marginTop: 12 }}>
            Program Not Found
          </Text>
          <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4, textAlign: 'center' }}>
            This program could not be loaded. Please try again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const progress =
    program.milestone_count > 0
      ? Math.round((program.completed_milestone_count / program.milestone_count) * 100)
      : 0;

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
          {/* Header Card */}
          <View
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 14,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#f8fafc' }}>{program.title}</Text>
            <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>{program.client_name}</Text>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <View
                style={{
                  backgroundColor: STATUS_COLORS[program.status] + '33',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: STATUS_COLORS[program.status] }}>
                  {program.status.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: RAG_COLORS[program.rag_status] + '33',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: RAG_COLORS[program.rag_status] }}>
                  {program.rag_status.toUpperCase()} STATUS
                </Text>
              </View>
            </View>

            {/* Progress */}
            <View style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 13, color: '#94a3b8' }}>Overall Progress</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#f8fafc' }}>{progress}%</Text>
              </View>
              <View style={{ height: 6, backgroundColor: '#0f172a', borderRadius: 3, overflow: 'hidden' }}>
                <View
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    backgroundColor: progress >= 100 ? '#22c55e' : '#eab308',
                    borderRadius: 3,
                  }}
                />
              </View>
              <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                {program.completed_milestone_count} of {program.milestone_count} milestones completed
              </Text>
            </View>
          </View>

          {/* Details */}
          <View
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 14,
              paddingHorizontal: 16,
              marginBottom: 16,
            }}
          >
            {program.budget_envelope && (
              <InfoRow
                label="Budget"
                value={new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                }).format(program.budget_envelope)}
              />
            )}
            {program.start_date && (
              <InfoRow
                label="Start Date"
                value={new Date(program.start_date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              />
            )}
            {program.end_date && (
              <InfoRow
                label="End Date"
                value={new Date(program.end_date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              />
            )}
            <InfoRow
              label="Created"
              value={new Date(program.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            />
          </View>

          {/* Objectives */}
          {program.objectives && (
            <View
              style={{
                backgroundColor: '#1e293b',
                borderRadius: 14,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#f8fafc', marginBottom: 8 }}>
                Objectives
              </Text>
              <Text style={{ fontSize: 14, color: '#94a3b8', lineHeight: 20 }}>
                {program.objectives}
              </Text>
            </View>
          )}

          {/* Scope */}
          {program.scope && (
            <View
              style={{
                backgroundColor: '#1e293b',
                borderRadius: 14,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#f8fafc', marginBottom: 8 }}>
                Scope
              </Text>
              <Text style={{ fontSize: 14, color: '#94a3b8', lineHeight: 20 }}>
                {program.scope}
              </Text>
            </View>
          )}

          {/* Milestones */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#f8fafc', marginBottom: 12 }}>
              Milestones ({program.milestones?.length ?? 0})
            </Text>
            {program.milestones && program.milestones.length > 0 ? (
              program.milestones.map((milestone) => (
                <MilestoneCard key={milestone.id} milestone={milestone} />
              ))
            ) : (
              <View
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: 12,
                  padding: 32,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 32 }}>🎯</Text>
                <Text style={{ color: '#64748b', marginTop: 8 }}>No milestones yet</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
