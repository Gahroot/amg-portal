import api from "@/lib/api";

export type SearchEntityType = "program" | "client" | "partner" | "document" | "task";

export interface SearchResultItem {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle: string | null;
  url: string;
  metadata: Record<string, string | null>;
  relevance_score: number;
}

export interface SearchResultGroup {
  type: SearchEntityType;
  label: string;
  results: SearchResultItem[];
  total: number;
  has_more: boolean;
}

export interface GlobalSearchResponse {
  query: string;
  groups: SearchResultGroup[];
  total: number;
  total_by_type: Record<string, number>;
  operators: {
    types: string[];
    excluded: string[];
    exact: boolean;
  };
}

export interface GlobalSearchParams {
  q: string;
  types?: SearchEntityType[];
  limit?: number;
  date_from?: string;
  date_to?: string;
  /** Comma-separated statuses to filter by */
  statuses?: string[];
  /** Comma-separated priorities to filter by (for tasks) */
  priorities?: string[];
  /** Filter by assigned user ID */
  assigned_to?: string;
  /** Filter by program ID */
  program_id?: string;
  /** Filter by client ID */
  client_id?: string;
}

// Suggestion types
export type SuggestionCategory =
  | "recent"
  | "popular"
  | "client"
  | "program"
  | "partner"
  | "document";

export interface SearchSuggestion {
  text: string;
  category: SuggestionCategory;
  display_text: string | null;
  subtitle: string | null;
  count: number | null;
}

export interface SearchSuggestionsResponse {
  query: string;
  suggestions: SearchSuggestion[];
  total: number;
}

/**
 * Perform global search across all entities
 */
export async function globalSearch(
  params: GlobalSearchParams
): Promise<GlobalSearchResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("q", params.q);

  if (params.types && params.types.length > 0) {
    searchParams.set("types", params.types.join(","));
  }
  if (params.limit) {
    searchParams.set("limit", params.limit.toString());
  }
  if (params.date_from) {
    searchParams.set("date_from", params.date_from);
  }
  if (params.date_to) {
    searchParams.set("date_to", params.date_to);
  }
  if (params.statuses && params.statuses.length > 0) {
    searchParams.set("statuses", params.statuses.join(","));
  }
  if (params.priorities && params.priorities.length > 0) {
    searchParams.set("priorities", params.priorities.join(","));
  }
  if (params.assigned_to) {
    searchParams.set("assigned_to", params.assigned_to);
  }
  if (params.program_id) {
    searchParams.set("program_id", params.program_id);
  }
  if (params.client_id) {
    searchParams.set("client_id", params.client_id);
  }

  const response = await api.post<GlobalSearchResponse>(
    "/api/v1/search/global",
    null,
    { params: Object.fromEntries(searchParams) }
  );
  return response.data;
}

/**
 * Get search suggestions with auto-complete based on partial query.
 * Suggestions include entity names (clients, programs, partners, documents)
 * and popular/common searches.
 */
export async function getSearchSuggestions(
  q: string,
  limit: number = 10
): Promise<SearchSuggestionsResponse> {
  const response = await api.get<SearchSuggestionsResponse>(
    "/api/v1/search/suggestions",
    {
      params: { q, limit },
    }
  );
  return response.data;
}
