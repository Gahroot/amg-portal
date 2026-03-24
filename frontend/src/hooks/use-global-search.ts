import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { globalSearch, type SearchEntityType, type GlobalSearchParams } from "@/lib/api/search";
import { recordRecentItem, type RecentItemType } from "@/lib/api/recent-items";

export interface RecentItem {
  id: string;
  type: RecentItemType;
  title: string;
  subtitle?: string | null;
  url: string;
  viewedAt?: string;
}

export interface UseGlobalSearchOptions {
  /** Types to filter by */
  types?: SearchEntityType[];
  /** Maximum results per type */
  limit?: number;
  /** Enable/disable the search */
  enabled?: boolean;
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Date filter - from */
  dateFrom?: string;
  /** Date filter - to */
  dateTo?: string;
  /** Status filter - list of statuses */
  statuses?: string[];
  /** Priority filter - list of priorities (for tasks) */
  priorities?: string[];
  /** Assigned user filter */
  assignedTo?: string;
  /** Program filter */
  programId?: string;
  /** Client filter */
  clientId?: string;
}

/**
 * Hook for performing global search with debouncing and caching
 */
export function useGlobalSearch(
  query: string,
  options: UseGlobalSearchOptions = {}
) {
  const {
    types,
    limit = 10,
    enabled = true,
    debounceMs = 300,
    dateFrom,
    dateTo,
    statuses,
    priorities,
    assignedTo,
    programId,
    clientId,
  } = options;

  const debouncedQuery = useDebounce(query, debounceMs);

  const searchResult = useQuery({
    queryKey: [
      "global-search",
      debouncedQuery,
      types,
      limit,
      dateFrom,
      dateTo,
      statuses,
      priorities,
      assignedTo,
      programId,
      clientId,
    ],
    queryFn: () =>
      globalSearch({
        q: debouncedQuery,
        types,
        limit,
        date_from: dateFrom,
        date_to: dateTo,
        statuses,
        priorities,
        assigned_to: assignedTo,
        program_id: programId,
        client_id: clientId,
      }),
    enabled: enabled && debouncedQuery.trim().length > 0,
    staleTime: 30_000, // Results stay fresh for 30 seconds
    placeholderData: (prev) => prev, // Keep previous results while loading
  });

  return {
    ...searchResult,
    debouncedQuery,
    // Convenience accessors
    groups: searchResult.data?.groups ?? [],
    total: searchResult.data?.total ?? 0,
    totalByType: searchResult.data?.total_by_type ?? {},
    operators: searchResult.data?.operators ?? {
      types: [],
      excluded: [],
      exact: false,
    },
  };
}

/**
 * Record a view of an item to the backend
 * This replaces the localStorage-based recent items tracking
 */
export function addRecentItem(
  item: Omit<RecentItem, "visitedAt"> & { item_id: string }
): void {
  // Fire and forget - don't await, don't block navigation
  recordRecentItem({
    item_type: item.type,
    item_id: item.item_id,
    item_title: item.title,
    item_subtitle: item.subtitle,
  }).catch((error) => {
    // Silently fail - this is not critical
    console.error("Failed to record recent item:", error);
  });
}

/**
 * Hook to search within a specific entity type
 */
export function useEntityTypeSearch(
  query: string,
  type: SearchEntityType,
  options: Omit<UseGlobalSearchOptions, "types"> = {}
) {
  return useGlobalSearch(query, { ...options, types: [type] });
}

/**
 * Parse search query for operators
 */
export function parseSearchQuery(query: string): {
  terms: string[];
  types: string[];
  excluded: string[];
  exact: boolean;
} {
  const result = {
    terms: [] as string[],
    types: [] as string[],
    excluded: [] as string[],
    exact: false,
  };

  let workingQuery = query;

  // Extract exact matches
  const exactMatches = query.match(/"([^"]+)"/g);
  if (exactMatches) {
    result.exact = true;
    for (const match of exactMatches) {
      result.terms.push(match.slice(1, -1));
      workingQuery = workingQuery.replace(match, "");
    }
  }

  // Extract type filters
  const typeMatches = workingQuery.match(/type:(\S+)/gi);
  if (typeMatches) {
    for (const match of typeMatches) {
      const type = match.split(":")[1].toLowerCase();
      result.types.push(type);
      workingQuery = workingQuery.replace(match, "");
    }
  }

  // Extract excluded terms
  const excludeMatches = workingQuery.match(/-(\S+)/g);
  if (excludeMatches) {
    for (const match of excludeMatches) {
      result.excluded.push(match.slice(1));
      workingQuery = workingQuery.replace(match, "");
    }
  }

  // Remaining terms
  result.terms.push(...workingQuery.split(/\s+/).filter(Boolean));

  return result;
}
