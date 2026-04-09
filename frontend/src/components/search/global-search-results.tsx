"use client";

import { ElementType } from "react";
import {
  FileText,
  Users,
  Briefcase,
  Building2,
  CheckSquare,
  ChevronRight,
  Loader2,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type {
  SearchResultGroup,
  SearchResultItem,
  SearchEntityType,
} from "@/lib/api/search";

// Icon mapping for entity types
const TYPE_ICONS: Record<SearchEntityType, ElementType> = {
  program: Briefcase,
  client: Users,
  partner: Building2,
  document: FileText,
  task: CheckSquare,
};

// Color mapping for entity type badges
const TYPE_COLORS: Record<SearchEntityType, string> = {
  program: "bg-blue-100/30 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  client: "bg-green-100/30 text-green-700 dark:bg-green-900 dark:text-green-300",
  partner: "bg-purple-100/30 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  document: "bg-orange-100/30 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  task: "bg-yellow-100/30 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
};

interface GlobalSearchResultsProps {
  /** Search result groups */
  groups: SearchResultGroup[];
  /** Total number of results */
  total: number;
  /** Search query for empty state message */
  query?: string;
  /** Whether search is loading */
  isLoading?: boolean;
  /** Whether to show type badges */
  showTypeBadges?: boolean;
  /** Maximum results to show per group (0 = show all) */
  maxPerGroup?: number;
  /** Callback when a result is selected */
  onSelect?: (item: SearchResultItem) => void;
  /** Callback to show more results for a type */
  onShowMore?: (type: SearchEntityType) => void;
  /** Custom class name */
  className?: string;
  /** Active/selected item ID */
  activeId?: string;
}

/**
 * Individual search result item component
 */
interface SearchResultRowProps {
  item: SearchResultItem;
  onSelect?: (item: SearchResultItem) => void;
  isActive?: boolean;
  showTypeBadge?: boolean;
}

function SearchResultRow({
  item,
  onSelect,
  isActive,
  showTypeBadge = false,
}: SearchResultRowProps) {
  const Icon = TYPE_ICONS[item.type] ?? FileText;

  return (
    <button
      onClick={() => onSelect?.(item)}
      className={cn(
        "w-full flex items-start gap-3 px-3 py-2.5 text-left rounded-md transition-colors",
        "hover:bg-accent focus:bg-accent focus:outline-none",
        isActive && "bg-accent"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center",
          TYPE_COLORS[item.type]
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{item.title}</span>
          {showTypeBadge && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {item.type}
            </Badge>
          )}
        </div>
        {item.subtitle && (
          <p className="text-sm text-muted-foreground truncate">
            {item.subtitle}
          </p>
        )}
      </div>
      {isActive && (
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
      )}
    </button>
  );
}

/**
 * Search result group component
 */
interface SearchResultGroupProps {
  group: SearchResultGroup;
  maxResults?: number;
  onSelect?: (item: SearchResultItem) => void;
  onShowMore?: () => void;
  activeId?: string;
}

function SearchResultGroupComponent({
  group,
  maxResults = 5,
  onSelect,
  onShowMore,
  activeId,
}: SearchResultGroupProps) {
  const displayResults = maxResults > 0 ? group.results.slice(0, maxResults) : group.results;
  const hasMore = group.has_more || group.total > displayResults.length;

  if (displayResults.length === 0) {
    return null;
  }

  return (
    <div className="py-2">
      {/* Group header */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {group.label}
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {group.total}
          </Badge>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-0.5">
        {displayResults.map((item) => (
          <SearchResultRow
            key={`${item.type}-${item.id}`}
            item={item}
            onSelect={onSelect}
            isActive={activeId === `${item.type}-${item.id}`}
          />
        ))}
      </div>

      {/* Show more button */}
      {hasMore && onShowMore && (
        <button
          onClick={onShowMore}
          className="w-full flex items-center justify-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          <span>Show {group.total - displayResults.length} more {group.label.toLowerCase()}</span>
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/**
 * Empty state component
 */
interface SearchEmptyStateProps {
  query?: string;
  isLoading?: boolean;
}

function SearchEmptyState({ query = "", isLoading }: SearchEmptyStateProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Searching...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">
        {query ? `No results found for "${query}"` : "Start typing to search"}
      </p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        Try adjusting your search or use type:client to filter
      </p>
    </div>
  );
}

/**
 * Main global search results component
 * Displays search results grouped by entity type with icons, counts, and "show more" buttons
 */
export function GlobalSearchResults({
  groups,
  total,
  isLoading = false,
  showTypeBadges: _showTypeBadges = false,
  maxPerGroup = 5,
  onSelect,
  onShowMore,
  className,
  activeId,
}: GlobalSearchResultsProps) {
  if (isLoading && groups.length === 0) {
    return (
      <div className={className}>
        <SearchEmptyState isLoading />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className={className}>
        <SearchEmptyState isLoading={false} />
      </div>
    );
  }

  return (
    <div className={cn("divide-y divide-border", className)}>
      {/* Total results header */}
      <div className="px-3 py-2 bg-muted/30">
        <p className="text-xs text-muted-foreground">
          {total} result{total !== 1 ? "s" : ""} found
        </p>
      </div>

      {/* Result groups */}
      {groups.map((group) => (
        <SearchResultGroupComponent
          key={group.type}
          group={group}
          maxResults={maxPerGroup}
          onSelect={onSelect}
          onShowMore={onShowMore ? () => onShowMore(group.type) : undefined}
          activeId={activeId}
        />
      ))}
    </div>
  );
}

/**
 * Compact search results for dropdown/command palette
 */
interface CompactSearchResultsProps {
  groups: SearchResultGroup[];
  isLoading?: boolean;
  onSelect: (item: SearchResultItem) => void;
  query: string;
  className?: string;
}

export function CompactSearchResults({
  groups,
  isLoading,
  onSelect,
  query,
  className,
}: CompactSearchResultsProps) {
  // Flatten all results for compact display
  const allResults = groups.flatMap((g) => g.results);

  if (isLoading && allResults.length === 0) {
    return (
      <div className={cn("py-6 text-center", className)}>
        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  if (allResults.length === 0 && query.trim()) {
    return (
      <div className={cn("py-6 text-center", className)}>
        <p className="text-sm text-muted-foreground">No results found</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-0.5", className)}>
      {allResults.map((item) => (
        <SearchResultRow
          key={`${item.type}-${item.id}`}
          item={item}
          onSelect={onSelect}
          showTypeBadge
        />
      ))}
    </div>
  );
}

export default GlobalSearchResults;
