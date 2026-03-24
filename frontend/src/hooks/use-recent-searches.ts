"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Types of searches that can be performed
 */
export type SearchType = "global" | "client" | "program" | "partner" | "document";

/**
 * A single recent search entry
 */
export interface RecentSearch {
  /** Unique identifier */
  id: string;
  /** The search query string */
  query: string;
  /** Type of search performed */
  type: SearchType;
  /** Timestamp when the search was performed */
  searchedAt: string;
}

/**
 * Store state for recent searches
 */
interface RecentSearchesState {
  /** List of recent searches, ordered by most recent first */
  searches: RecentSearch[];
}

/**
 * Store actions for recent searches
 */
interface RecentSearchesActions {
  /** Add a new search to the history */
  addSearch: (query: string, type: SearchType) => void;
  /** Remove a specific search from history */
  removeSearch: (id: string) => void;
  /** Clear all search history */
  clearSearches: () => void;
  /** Clear searches of a specific type */
  clearSearchesByType: (type: SearchType) => void;
  /** Get searches filtered by type */
  getSearchesByType: (type: SearchType) => RecentSearch[];
}

type RecentSearchesStore = RecentSearchesState & RecentSearchesActions;

/** Maximum number of recent searches to store */
const MAX_RECENT_SEARCHES = 10;

/** LocalStorage key for persistence */
const STORAGE_KEY = "amg-recent-searches";

/**
 * Generate a unique ID for a search entry
 */
function generateSearchId(): string {
  return `search-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Normalize a search query for comparison (lowercase, trimmed)
 */
function normalizeQuery(query: string): string {
  return query.toLowerCase().trim();
}

/**
 * Zustand store for recent searches with localStorage persistence
 */
export const useRecentSearchesStore = create<RecentSearchesStore>()(
  persist(
    (set, get) => ({
      searches: [],

      addSearch: (query, type) => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) return;

        const normalizedQuery = normalizeQuery(trimmedQuery);
        const existingSearches = get().searches;

        // Remove duplicate searches (same query, regardless of type)
        const filteredSearches = existingSearches.filter(
          (s) => normalizeQuery(s.query) !== normalizedQuery
        );

        // Create new search entry
        const newSearch: RecentSearch = {
          id: generateSearchId(),
          query: trimmedQuery,
          type,
          searchedAt: new Date().toISOString(),
        };

        // Prepend new search and limit to max
        const updatedSearches = [newSearch, ...filteredSearches].slice(
          0,
          MAX_RECENT_SEARCHES
        );

        set({ searches: updatedSearches });
      },

      removeSearch: (id) => {
        set((state) => ({
          searches: state.searches.filter((s) => s.id !== id),
        }));
      },

      clearSearches: () => {
        set({ searches: [] });
      },

      clearSearchesByType: (type) => {
        set((state) => ({
          searches: state.searches.filter((s) => s.type !== type),
        }));
      },

      getSearchesByType: (type) => {
        return get().searches.filter((s) => s.type === type);
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        searches: state.searches,
      }),
    }
  )
);

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook to get all recent searches
 */
export function useRecentSearches(): RecentSearch[] {
  return useRecentSearchesStore((state) => state.searches);
}

/**
 * Hook to get recent searches filtered by type
 */
export function useRecentSearchesByType(type: SearchType): RecentSearch[] {
  const searches = useRecentSearchesStore((state) => state.searches);
  return searches.filter((s) => s.type === type);
}

/**
 * Hook to get recent global searches (most common use case)
 */
export function useRecentGlobalSearches(): RecentSearch[] {
  return useRecentSearchesByType("global");
}

/**
 * Hook to add a search to history
 */
export function useAddRecentSearch() {
  return useRecentSearchesStore((state) => state.addSearch);
}

/**
 * Hook to remove a search from history
 */
export function useRemoveRecentSearch() {
  return useRecentSearchesStore((state) => state.removeSearch);
}

/**
 * Hook to clear all search history
 */
export function useClearRecentSearches() {
  return useRecentSearchesStore((state) => state.clearSearches);
}

/**
 * Hook to clear searches of a specific type
 */
export function useClearRecentSearchesByType() {
  return useRecentSearchesStore((state) => state.clearSearchesByType);
}

/**
 * Format a relative time string for a search
 */
export function formatSearchTime(searchedAt: string): string {
  const now = new Date();
  const searched = new Date(searchedAt);
  const diffMs = now.getTime() - searched.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return searched.toLocaleDateString();
}
