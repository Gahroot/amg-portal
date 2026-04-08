import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { getSearchSuggestions } from "@/lib/api/search";
import { queryKeys } from "@/lib/query-keys";

/**
 * Hook to fetch search suggestions with debouncing.
 *
 * @param query - The search query
 * @param debounceMs - Debounce delay in milliseconds (default: 200)
 * @param enabled - Whether to fetch suggestions (default: true)
 */
export function useSearchSuggestions(
  query: string,
  debounceMs: number = 200,
  enabled: boolean = true
) {
  const debouncedQuery = useDebounce(query, debounceMs);

  const result = useQuery({
    queryKey: queryKeys.searchSuggestions(debouncedQuery),
    queryFn: () => getSearchSuggestions(debouncedQuery, 10),
    enabled: enabled,
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes
  });

  return {
    ...result,
    // Convenience accessors
    suggestions: result.data?.suggestions ?? [],
    total: result.data?.total ?? 0,
  };
}
