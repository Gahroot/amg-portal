import { useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, Globe, Star, ChevronRight, Handshake, MapPin } from 'lucide-react-native';

import { listPartners } from '@/lib/api/partners';
import { SearchInput } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/layout/empty-state';
import { LoadingList } from '@/components/layout/loading-skeleton';
import type { Partner, PartnerCapability } from '@/types/partner';

const CAPABILITY_LABELS: Record<PartnerCapability, string> = {
  investment_advisory: 'Investment Advisory',
  tax_planning: 'Tax Planning',
  estate_planning: 'Estate Planning',
  real_estate: 'Real Estate',
  art_advisory: 'Art Advisory',
  philanthropy: 'Philanthropy',
  legal: 'Legal',
  insurance: 'Insurance',
  concierge: 'Concierge',
  security: 'Security',
  other: 'Other',
};

export default function InternalPartnersScreen() {
  const [search, setSearch] = useState('');
  const [capabilityFilter, setCapabilityFilter] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['partners', { capabilityFilter }],
    queryFn: () => listPartners({ capability: capabilityFilter ?? undefined, limit: 50 }),
  });

  const partners = data?.profiles ?? [];

  const filteredPartners = partners.filter((partner) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      partner.firm_name.toLowerCase().includes(searchLower) ||
      partner.contact_name?.toLowerCase().includes(searchLower) ||
      partner.contact_email?.toLowerCase().includes(searchLower)
    );
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Get unique capabilities from partners
  const allCapabilities = partners.flatMap((p) => p.capabilities || []);
  const uniqueCapabilities = [...new Set(allCapabilities)] as string[];
  const capabilityFilters = ['All', ...uniqueCapabilities.slice(0, 5)];

  const renderPartner = ({ item }: { item: Partner }) => (
    <Card className="mb-3">
      <Pressable className="flex-row items-start">
        <View className="flex-1">
          {/* Header */}
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-semibold text-foreground">{item.firm_name}</Text>
            {item.compliance_verified && (
              <Badge variant="success">
                <Text className="text-xs font-medium text-green-700">Verified</Text>
              </Badge>
            )}
          </View>

          {/* Capabilities */}
          {item.capabilities && item.capabilities.length > 0 && (
            <View className="mt-2 flex-row flex-wrap gap-1">
              {item.capabilities.slice(0, 3).map((cap) => (
                <Badge key={cap} variant="secondary">
                  <Text className="text-xs">{CAPABILITY_LABELS[cap as PartnerCapability] || cap}</Text>
                </Badge>
              ))}
              {item.capabilities.length > 3 && (
                <Badge variant="secondary">
                  <Text className="text-xs">+{item.capabilities.length - 3}</Text>
                </Badge>
              )}
            </View>
          )}

          {/* Geographies */}
          {item.geographies && item.geographies.length > 0 && (
            <View className="mt-2 flex-row items-center gap-1">
              <MapPin color="#94a3b8" size={12} />
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {item.geographies.slice(0, 3).join(', ')}
                {item.geographies.length > 3 && ` +${item.geographies.length - 3} more`}
              </Text>
            </View>
          )}

          {/* Contact Info */}
          <View className="mt-3 gap-1.5">
            {item.contact_name && (
              <Text className="text-sm text-muted-foreground">{item.contact_name}</Text>
            )}
            <View className="flex-row items-center gap-2">
              <Mail color="#94a3b8" size={14} />
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                {item.contact_email}
              </Text>
            </View>
            {item.contact_phone && (
              <View className="flex-row items-center gap-2">
                <Phone color="#94a3b8" size={14} />
                <Text className="text-sm text-muted-foreground">{item.contact_phone}</Text>
              </View>
            )}
          </View>

          {/* Rating and Stats */}
          <View className="mt-3 flex-row items-center gap-4">
            {item.performance_rating && (
              <View className="flex-row items-center gap-1">
                <Star color="#eab308" size={14} fill="#eab308" />
                <Text className="text-sm font-medium text-foreground">
                  {item.performance_rating.toFixed(1)}
                </Text>
              </View>
            )}
            <Text className="text-sm text-muted-foreground">
              {item.completed_assignments} completed
            </Text>
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
            placeholder="Search partners..."
          />

          {/* Capability Filter Pills */}
          {uniqueCapabilities.length > 0 && (
            <View className="flex-row gap-2 overflow-x-auto pb-2">
              {capabilityFilters.map((capability) => (
                <Pressable
                  key={capability}
                  onPress={() => setCapabilityFilter(capability === 'All' ? null : capability)}
                  className={`rounded-full px-3 py-1.5 ${
                    (capability === 'All' && !capabilityFilter) || capabilityFilter === capability
                      ? 'bg-primary'
                      : 'bg-secondary'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      (capability === 'All' && !capabilityFilter) || capabilityFilter === capability
                        ? 'text-primary-foreground'
                        : 'text-secondary-foreground'
                    }`}
                  >
                    {capability === 'All' ? 'All' : CAPABILITY_LABELS[capability as PartnerCapability] || capability}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Partners List */}
        <FlatList
          data={filteredPartners}
          keyExtractor={(item) => item.id}
          renderItem={renderPartner}
          contentContainerClassName="px-4 pb-4"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListHeaderComponent={
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-sm text-muted-foreground">
                {filteredPartners.length} partner{filteredPartners.length !== 1 ? 's' : ''}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon={Handshake}
              title="No Partners Found"
              description={search ? 'Try adjusting your search or filters.' : 'No partners have been added yet.'}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}
