"use client";

import { ElementType } from "react";
import type { MouseEvent, ReactNode } from "react";
import { Search, X, Clock, Trash2 } from "lucide-react";
import {
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useRecentSearches,
  useRemoveRecentSearch,
  useClearRecentSearches,
  formatSearchTime,
  type RecentSearch,
  type SearchType,
} from "@/hooks/use-recent-searches";
import { cn } from "@/lib/utils";

/**
 * Icon mapping for search types
 */
const SEARCH_TYPE_ICONS: Record<SearchType, ElementType> = {
  global: Search,
  client: Search,
  program: Search,
  partner: Search,
  document: Search,
};

/**
 * Label mapping for search types
 */
const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
  global: "All",
  client: "Clients",
  program: "Programs",
  partner: "Partners",
  document: "Documents",
};

/**
 * Props for the RecentSearches component
 */
interface RecentSearchesProps {
  /** Filter searches by type (optional) */
  filterType?: SearchType;
  /** Maximum number of searches to display */
  limit?: number;
  /** Callback when a search is selected */
  onSelectSearch: (query: string, type: SearchType) => void;
  /** Whether to show the clear all button */
  showClearAll?: boolean;
  /** Whether to show timestamps */
  showTimestamps?: boolean;
  /** Whether to show search type badges */
  showTypeBadge?: boolean;
  /** Custom class name */
  className?: string;
  /** Whether to show the section separator */
  showSeparator?: boolean;
}

/**
 * A single recent search item component
 */
interface RecentSearchItemProps {
  search: RecentSearch;
  onSelect: () => void;
  onRemove: () => void;
  showTimestamp?: boolean;
  showTypeBadge?: boolean;
}

function RecentSearchItem({
  search,
  onSelect,
  onRemove,
  showTimestamp = true,
  showTypeBadge = true,
}: RecentSearchItemProps) {
  const Icon = SEARCH_TYPE_ICONS[search.type];

  const handleRemove = (e: MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  return (
    <CommandItem
      value={`recent-search ${search.query}`}
      onSelect={onSelect}
      className="group flex items-center justify-between gap-2"
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{search.query}</span>
        {showTypeBadge && search.type !== "global" && (
          <span className="shrink-0 text-xs text-muted-foreground">
            in {SEARCH_TYPE_LABELS[search.type]}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {showTimestamp && (
          <span className="text-xs text-muted-foreground">
            {formatSearchTime(search.searchedAt)}
          </span>
        )}
        <button
          onClick={handleRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded-sm"
          aria-label="Remove search"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    </CommandItem>
  );
}

/**
 * Recent searches dropdown component for use in the command palette
 * Displays a list of recent searches with options to re-run or remove them
 */
export function RecentSearches({
  filterType,
  limit = 5,
  onSelectSearch,
  showClearAll = true,
  showTimestamps = true,
  showTypeBadge = true,
  className,
  showSeparator = false,
}: RecentSearchesProps) {
  const allSearches = useRecentSearches();
  const removeSearch = useRemoveRecentSearch();
  const clearSearches = useClearRecentSearches();

  // Filter by type if specified
  const searches = filterType
    ? allSearches.filter((s) => s.type === filterType)
    : allSearches;

  // Limit the number of searches displayed
  const displaySearches = searches.slice(0, limit);

  if (displaySearches.length === 0) {
    return null;
  }

  const handleSelectSearch = (search: RecentSearch) => {
    onSelectSearch(search.query, search.type);
  };

  const handleRemoveSearch = (id: string) => {
    removeSearch(id);
  };

  const handleClearAll = () => {
    clearSearches();
  };

  return (
    <>
      {showSeparator && <CommandSeparator />}
      <CommandGroup
        heading={
          <div className="flex items-center justify-between w-full pr-2">
            <span className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Recent Searches
            </span>
            {showClearAll && searches.length > 1 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        }
        className={cn("px-2", className)}
      >
        {displaySearches.map((search) => (
          <RecentSearchItem
            key={search.id}
            search={search}
            onSelect={() => handleSelectSearch(search)}
            onRemove={() => handleRemoveSearch(search.id)}
            showTimestamp={showTimestamps}
            showTypeBadge={showTypeBadge}
          />
        ))}
      </CommandGroup>
    </>
  );
}

/**
 * Compact recent searches list for dropdown menus
 */
interface CompactRecentSearchesProps {
  limit?: number;
  onSelectSearch: (query: string) => void;
  className?: string;
}

export function CompactRecentSearches({
  limit = 5,
  onSelectSearch,
  className,
}: CompactRecentSearchesProps) {
  const searches = useRecentSearches();
  const displaySearches = searches.slice(0, limit);

  if (displaySearches.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-1", className)}>
      {displaySearches.map((search) => (
        <button
          key={search.id}
          onClick={() => onSelectSearch(search.query)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded-sm transition-colors text-left"
        >
          <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="truncate flex-1">{search.query}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatSearchTime(search.searchedAt)}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Recent searches menu with clear options
 */
interface RecentSearchesMenuProps {
  trigger: ReactNode;
  limit?: number;
  onSelectSearch: (query: string) => void;
}

export function RecentSearchesMenu({
  trigger,
  limit = 5,
  onSelectSearch,
}: RecentSearchesMenuProps) {
  const searches = useRecentSearches();
  const removeSearch = useRemoveRecentSearch();
  const clearSearches = useClearRecentSearches();
  const displaySearches = searches.slice(0, limit);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {displaySearches.length === 0 ? (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            No recent searches
          </div>
        ) : (
          <>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Recent Searches
            </div>
            {displaySearches.map((search) => (
              <DropdownMenuItem
                key={search.id}
                onClick={() => onSelectSearch(search.query)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{search.query}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSearch(search.id);
                  }}
                  className="p-1 hover:bg-muted rounded-sm"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuItem>
            ))}
            {searches.length > 0 && (
              <>
                <div className="h-px bg-border my-1" />
                <DropdownMenuItem
                  onClick={() => clearSearches()}
                  className="text-muted-foreground"
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Clear all searches
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default RecentSearches;
