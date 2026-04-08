import { useInfiniteQuery } from "@tanstack/react-query";
import { getClientTimeline } from "@/lib/api/client-timeline";
import { queryKeys } from "@/lib/query-keys";
import type { TimelineFilters } from "@/types/client-timeline";

const PAGE_SIZE = 50;

export function useClientTimeline(
  profileId: string | undefined,
  filters?: TimelineFilters
) {
  return useInfiniteQuery({
    queryKey: queryKeys.clients.timeline(profileId, filters),
    queryFn: async ({ pageParam = 0 }) => {
      return getClientTimeline(profileId!, {
        event_types: filters?.event_types?.join(","),
        date_from: filters?.date_from,
        date_to: filters?.date_to,
        skip: pageParam as number,
        limit: PAGE_SIZE,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (!lastPage.has_more) return undefined;
      return (lastPageParam as number) + PAGE_SIZE;
    },
    enabled: !!profileId,
    staleTime: 60_000,
  });
}
