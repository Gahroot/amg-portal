import { useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, MapPin, ChevronRight, Filter, Users } from 'lucide-react-native';

import { listClients } from '@/lib/api/clients';
import { SearchInput } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/layout/empty-state';
import { LoadingList } from '@/components/layout/loading-skeleton';
import { ComplianceBadge } from '@/components/status/client-status-badge';
import type { ClientProfile, ClientType } from '@/types/client';

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  uhnw_individual: 'UHNW Individual',
  family_office: 'Family Office',
  global_executive: 'Global Executive',
};

export default function InternalClientsScreen() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clients', { search, statusFilter }],
    queryFn: () => listClients({ search, compliance_status: statusFilter ?? undefined, limit: 50 }),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const clients = data?.profiles ?? [];

  const filteredClients = clients.filter((client) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      client.legal_name.toLowerCase().includes(searchLower) ||
      client.primary_email.toLowerCase().includes(searchLower) ||
      client.display_name?.toLowerCase().includes(searchLower)
    );
  });

  const statusFilters = [
    { value: null, label: 'All' },
    { value: 'pending_review', label: 'Pending' },
    { value: 'under_review', label: 'In Review' },
    { value: 'cleared', label: 'Cleared' },
    { value: 'flagged', label: 'Flagged' },
  ];

  const renderClient = ({ item }: { item: ClientProfile }) => (
    <Card className="mb-3">
      <Pressable className="flex-row items-start">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-semibold text-foreground">
              {item.display_name || item.legal_name}
            </Text>
            {item.entity_type && (
              <Badge variant="secondary">{CLIENT_TYPE_LABELS[item.entity_type as ClientType] || item.entity_type}</Badge>
            )}
          </View>
          
          {item.display_name && item.legal_name !== item.display_name && (
            <Text className="mt-0.5 text-sm text-muted-foreground">{item.legal_name}</Text>
          )}

          <View className="mt-2 flex-row items-center gap-4">
            <ComplianceBadge status={item.compliance_status} />
          </View>

          <View className="mt-3 gap-1.5">
            <View className="flex-row items-center gap-2">
              <Mail color="#94a3b8" size={14} />
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                {item.primary_email}
              </Text>
            </View>
            {item.jurisdiction && (
              <View className="flex-row items-center gap-2">
                <MapPin color="#94a3b8" size={14} />
                <Text className="text-sm text-muted-foreground">{item.jurisdiction}</Text>
              </View>
            )}
          </View>
        </View>

        <ChevronRight color="#94a3b8" size={20} />
      </Pressable>
    </Card>
  );

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
            placeholder="Search clients..."
          />

          {/* Status Filter Pills */}
          <View className="flex-row gap-2 overflow-x-auto pb-2">
            {statusFilters.map((filter) => (
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
        </View>

        {/* Client List */}
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => item.id}
          renderItem={renderClient}
          contentContainerClassName="px-4 pb-4"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListHeaderComponent={
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-sm text-muted-foreground">
                {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon={Users}
              title="No Clients Found"
              description={search ? 'Try adjusting your search or filters.' : 'No clients have been added yet.'}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}
