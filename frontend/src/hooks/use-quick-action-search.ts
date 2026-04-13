"use client";

import { useMemo } from "react";
import type { QuickAction } from "@/providers/quick-actions-provider";

/**
 * Return type for useQuickActionSearch
 */
export interface UseQuickActionSearchReturn {
  /** Actions filtered and ranked by the search query */
  results: QuickAction[];
  /** Whether the query returned no results */
  isEmpty: boolean;
}

/**
 * Hook that filters a list of quick actions by a search query.
 *
 * Matching priority:
 * 1. Label starts with query (case-insensitive)
 * 2. Label contains query
 * 3. Description contains query
 *
 * When `query` is empty all actions are returned in their original order.
 */
export function useQuickActionSearch(
  actions: QuickAction[],
  query: string
): UseQuickActionSearchReturn {
  const results = useMemo<QuickAction[]>(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return actions;

    const scored = actions
      .map((action) => {
        const label = action.label.toLowerCase();
        const description = action.description?.toLowerCase() ?? "";

        let score = 0;
        if (label.startsWith(trimmed)) score = 3;
        else if (label.includes(trimmed)) score = 2;
        else if (description.includes(trimmed)) score = 1;

        return { action, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.map(({ action }) => action);
  }, [actions, query]);

  return { results, isEmpty: results.length === 0 };
}
