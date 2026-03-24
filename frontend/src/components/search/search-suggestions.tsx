"use client";

import * as React from "react";
import { Building2, FileText, TrendingUp, User, Briefcase, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchSuggestion, SuggestionCategory } from "@/lib/api/search";
import { useRecentSearches } from "@/hooks/use-recent-searches";

/**
 * Category icon mapping
 */
const CATEGORY_ICONS: Record<SuggestionCategory, React.ElementType> = {
  recent: Clock,
  popular: TrendingUp,
  client: User,
  program: Briefcase,
  partner: Building2,
  document: FileText,
};

/**
 * Category label mapping for display
 */
const CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  recent: "Recent",
  popular: "Popular",
  client: "Client",
  program: "Program",
  partner: "Partner",
  document: "Document",
};

/**
 * Props for SearchSuggestions component
 */
interface SearchSuggestionsProps {
  /** Search query for highlighting matches */
  query: string;
  /** API suggestions */
  suggestions: SearchSuggestion[];
  /** Currently selected index for keyboard navigation */
  selectedIndex: number;
  /** Callback when a suggestion is clicked or selected */
  onSelectSuggestion: (suggestion: SearchSuggestion) => void;
  /** Callback when a suggestion is hovered */
  onHoverSuggestion?: (index: number) => void;
  /** Whether suggestions are loading */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
  /** Whether to show recent searches when no suggestions */
  showRecentSearches?: boolean;
  /** Callback when a recent search is selected */
  onSelectRecentSearch?: (query: string) => void;
}

/**
 * Parse display text with **bold** markers into React elements
 */
function parseHighlightedText(text: string, query: string): React.ReactNode {
  if (!text.includes("**")) {
    return text;
  }

  const parts = text.split("**");
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <mark key={index} className="bg-transparent font-semibold text-foreground">
          {part}
        </mark>
      );
    }
    return part;
  });
}

/**
 * Single suggestion item component
 */
interface SuggestionItemProps {
  suggestion: SearchSuggestion;
  query: string;
  isSelected: boolean;
  onClick: () => void;
  onHover: () => void;
}

function SuggestionItem({
  suggestion,
  query,
  isSelected,
  onClick,
  onHover,
}: SuggestionItemProps) {
  const Icon = CATEGORY_ICONS[suggestion.category];
  const displayText = suggestion.display_text || suggestion.text;

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={onClick}
      onMouseEnter={onHover}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        isSelected && "bg-accent text-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 overflow-hidden">
        <div className="truncate">
          {parseHighlightedText(displayText, query)}
        </div>
        {suggestion.subtitle && (
          <div className="text-xs text-muted-foreground truncate">
            {suggestion.subtitle}
          </div>
        )}
      </div>
      {suggestion.count !== null && suggestion.count > 0 && (
        <span className="text-xs text-muted-foreground">
          {suggestion.count}
        </span>
      )}
    </button>
  );
}

/**
 * Loading skeleton for suggestions
 */
function SuggestionsSkeleton() {
  return (
    <div className="p-2 space-y-1">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 py-2 animate-pulse"
        >
          <div className="h-4 w-4 bg-muted rounded" />
          <div className="flex-1 h-4 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Recent search item component
 */
interface RecentSearchItemProps {
  query: string;
  searchedAt: string;
  isSelected: boolean;
  onClick: () => void;
  onHover: () => void;
}

function RecentSearchItem({
  query: searchQuery,
  searchedAt,
  isSelected,
  onClick,
  onHover,
}: RecentSearchItemProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={onClick}
      onMouseEnter={onHover}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        isSelected && "bg-accent text-accent-foreground"
      )}
    >
      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{searchQuery}</span>
      <span className="text-xs text-muted-foreground">
        {formatRelativeTime(searchedAt)}
      </span>
    </button>
  );
}

/**
 * Format a relative time string
 */
function formatRelativeTime(isoString: string): string {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Search suggestions dropdown component with keyboard navigation support.
 *
 * Displays:
 * - Recent searches (when no query)
 * - Type-ahead suggestions from entities (clients, programs, partners, documents)
 * - Popular searches
 */
export function SearchSuggestions({
  query,
  suggestions,
  selectedIndex,
  onSelectSuggestion,
  onHoverSuggestion,
  isLoading = false,
  className,
  showRecentSearches = true,
  onSelectRecentSearch,
}: SearchSuggestionsProps) {
  const recentSearches = useRecentSearches();

  // Build the list of items to display (includes both API suggestions and recent searches)
  const allItems: Array<
    | { type: "suggestion"; data: SearchSuggestion }
    | { type: "recent"; data: { query: string; searchedAt: string } }
  > = [];

  // Add API suggestions first
  for (const suggestion of suggestions) {
    allItems.push({ type: "suggestion", data: suggestion });
  }

  // Add recent searches if enabled and no query or few suggestions
  if (
    showRecentSearches &&
    recentSearches.length > 0 &&
    (query.length === 0 || suggestions.length < 3)
  ) {
    // Only add recent searches that aren't already in suggestions
    const suggestionTexts = new Set(
      suggestions.map((s) => s.text.toLowerCase())
    );
    for (const recent of recentSearches.slice(0, 5)) {
      if (!suggestionTexts.has(recent.query.toLowerCase())) {
        allItems.push({
          type: "recent",
          data: { query: recent.query, searchedAt: recent.searchedAt },
        });
      }
    }
  }

  // Loading state
  if (isLoading && suggestions.length === 0) {
    return (
      <div className={cn("w-full bg-popover border rounded-md shadow-lg", className)}>
        <SuggestionsSkeleton />
      </div>
    );
  }

  // Empty state - show popular searches or nothing
  if (allItems.length === 0 && query.length === 0) {
    return null;
  }

  // No results state
  if (allItems.length === 0 && query.length > 0) {
    return (
      <div className={cn("w-full bg-popover border rounded-md shadow-lg p-4", className)}>
        <p className="text-sm text-muted-foreground text-center">
          No suggestions for "{query}"
        </p>
      </div>
    );
  }

  // Calculate the actual selected index across all items
  let currentIndex = 0;
  const itemsWithIndex = allItems.map((item) => {
    const idx = currentIndex++;
    return { ...item, displayIndex: idx };
  });

  // Group suggestions by category for display
  const groupedItems = itemsWithIndex.reduce(
    (acc, item) => {
      const category =
        item.type === "recent" ? "recent" : item.data.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    },
    {} as Record<string, typeof itemsWithIndex>
  );

  // Order of categories for display
  const categoryOrder: SuggestionCategory[] = [
    "client",
    "program",
    "partner",
    "document",
    "popular",
    "recent",
  ];

  return (
    <div
      role="listbox"
      className={cn(
        "w-full bg-popover border rounded-md shadow-lg overflow-hidden",
        className
      )}
    >
      {categoryOrder.map((category) => {
        const items = groupedItems[category];
        if (!items || items.length === 0) return null;

        return (
          <div key={category}>
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
              {CATEGORY_LABELS[category]}
            </div>
            {items.map((item) => {
              if (item.type === "recent") {
                return (
                  <RecentSearchItem
                    key={`recent-${item.data.query}`}
                    query={item.data.query}
                    searchedAt={item.data.searchedAt}
                    isSelected={item.displayIndex === selectedIndex}
                    onClick={() => onSelectRecentSearch?.(item.data.query)}
                    onHover={() => onHoverSuggestion?.(item.displayIndex)}
                  />
                );
              }
              return (
                <SuggestionItem
                  key={`${item.data.category}-${item.data.text}`}
                  suggestion={item.data}
                  query={query}
                  isSelected={item.displayIndex === selectedIndex}
                  onClick={() => onSelectSuggestion(item.data)}
                  onHover={() => onHoverSuggestion?.(item.displayIndex)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default SearchSuggestions;
