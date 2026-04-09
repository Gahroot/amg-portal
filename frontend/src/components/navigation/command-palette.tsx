"use client";

import { ElementType, Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Users,
  Briefcase,
  Building2,
  Plus,
  Mail,
  AlertTriangle,
  CheckSquare,
  Clock,
  Search,
  Keyboard,
  Filter,
  X,
} from "lucide-react";
import { getNavConfigForRole, getGroupedNavItems } from "@/lib/nav-utils";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/auth-provider";
import { useGlobalSearch, parseSearchQuery } from "@/hooks/use-global-search";
import {
  useRecentItems,
  useRecordRecentItem,
} from "@/hooks/use-recent-items";
import {
  useAddRecentSearch,
  type SearchType,
} from "@/hooks/use-recent-searches";
import { RecentSearches } from "@/components/search/recent-searches";
import { useKeyboardShortcutsDialog } from "@/components/ui/keyboard-shortcuts-dialog";
import type { SearchResultItem, SearchEntityType } from "@/lib/api/search";

const INTERNAL_ROLES = [
  "managing_director",
  "relationship_manager",
  "coordinator",
  "finance_compliance",
];

const TYPE_ICONS: Record<string, ElementType> = {
  program: Briefcase,
  client: Users,
  partner: Building2,
  document: FileText,
  task: CheckSquare,
};

const TYPE_LABELS: Record<string, string> = {
  program: "Program",
  client: "Client",
  partner: "Partner",
  document: "Document",
  task: "Task",
};

// Type filter options
const TYPE_FILTERS: { type: SearchEntityType | "all"; label: string; icon: ElementType }[] = [
  { type: "all", label: "All", icon: Search },
  { type: "client", label: "Clients", icon: Users },
  { type: "program", label: "Programs", icon: Briefcase },
  { type: "partner", label: "Partners", icon: Building2 },
  { type: "task", label: "Tasks", icon: CheckSquare },
  { type: "document", label: "Documents", icon: FileText },
];

interface CommandPaletteProps {
  /** Control the open state from outside */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CommandPaletteProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeTypeFilter, setActiveTypeFilter] = useState<SearchEntityType | "all">("all");
  const router = useRouter();
  const { user } = useAuth();
  const { open: openShortcutsDialog } = useKeyboardShortcutsDialog();

  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  // Parse query for operators
  const parsedQuery = useMemo(() => parseSearchQuery(query), [query]);

  // Determine type filter from query operators or active filter
  const typeFilter = useMemo(() => {
    // If query has type: operator, use that
    if (parsedQuery.types.length > 0) {
      return parsedQuery.types[0] as SearchEntityType;
    }
    // Otherwise use the active filter tab
    return activeTypeFilter === "all" ? undefined : activeTypeFilter;
  }, [parsedQuery.types, activeTypeFilter]);

  const { data, isLoading, debouncedQuery } = useGlobalSearch(query, {
    types: typeFilter ? [typeFilter] : undefined,
    limit: 10,
  });

  const { data: recentItemsData } = useRecentItems(5);
  const recordRecentItem = useRecordRecentItem();
  const addRecentSearch = useAddRecentSearch();

  const hasQuery = debouncedQuery.trim().length > 0;

  const navGroups = useMemo(() => {
    if (!user) return {};
    const config = getNavConfigForRole(user.role);
    return getGroupedNavItems(config, user.role);
  }, [user]);

  // Track if a search has been performed (for recording to recent searches)
  const hasPerformedSearch = useRef(false);

  // Record search query when search results come back
  useEffect(() => {
    if (
      hasQuery &&
      data &&
      data.total > 0 &&
      !hasPerformedSearch.current
    ) {
      addRecentSearch(debouncedQuery, "global");
      hasPerformedSearch.current = true;
    }
    // Reset when query changes
    if (!hasQuery) {
      hasPerformedSearch.current = false;
    }
  }, [hasQuery, data, debouncedQuery, addRecentSearch]);

  // Keyboard shortcut: Cmd/Ctrl+K (only when not controlled)
  useEffect(() => {
    // Skip if controlled - parent handles the keyboard shortcut
    if (controlledOpen !== undefined) return;

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setInternalOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [controlledOpen]);

  // Reset query when dialog opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveTypeFilter("all");
    }
  }, [open]);

  function handleSelect(item: SearchResultItem) {
    // Record this view
    recordRecentItem.mutate({
      item_type: item.type as "program" | "client" | "partner" | "document" | "task",
      item_id: item.id,
      item_title: item.title,
      item_subtitle: item.subtitle,
    });
    setOpen(false);
    router.push(item.url);
  }

  function handleRecentSelect(item: {
    item_type: string;
    item_id: string;
    item_title: string;
    item_subtitle: string | null;
    url: string;
  }) {
    // Re-record this view to update timestamp
    recordRecentItem.mutate({
      item_type: item.item_type as
        | "program"
        | "client"
        | "partner"
        | "document"
        | "task",
      item_id: item.item_id,
      item_title: item.item_title,
      item_subtitle: item.item_subtitle,
    });
    setOpen(false);
    router.push(item.url);
  }

  function handleAction(url: string) {
    setOpen(false);
    router.push(url);
  }

  function handleShowShortcuts() {
    setOpen(false);
    openShortcutsDialog();
  }

  function handleRecentSearchSelect(searchQuery: string, type: SearchType) {
    // Set the query to re-run the search
    setQuery(searchQuery);
    // Re-record the search to update its timestamp
    addRecentSearch(searchQuery, type);
  }

  function handleTypeFilterClick(type: SearchEntityType | "all") {
    setActiveTypeFilter(type);
    // If there's a type: operator in the query, remove it
    if (parsedQuery.types.length > 0) {
      const cleanedQuery = query.replace(/type:\S+/gi, "").trim();
      setQuery(cleanedQuery);
    }
  }

  const groups = useMemo(() => data?.groups ?? [], [data]);
  const recentItems = recentItemsData?.items ?? [];

  // Group results by type for legacy rendering
  const _grouped = useMemo(() => {
    const result: Record<string, SearchResultItem[]> = {};
    for (const group of groups) {
      result[group.type] = group.results;
    }
    return result;
  }, [groups]);

  if (!user) return null;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search programs, clients, partners, and more..."
      showCloseButton={false}
    >
      <CommandInput
        placeholder="Search programs, clients, partners... (try type:client or 'exact phrase')"
        value={query}
        onValueChange={setQuery}
      />

      {/* Type filter tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b">
        {TYPE_FILTERS.map((filter) => {
          const Icon = filter.icon;
          const isActive = activeTypeFilter === filter.type;
          return (
            <button
              key={filter.type}
              onClick={() => handleTypeFilterClick(filter.type)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {filter.label}
            </button>
          );
        })}
      </div>

      {/* Active filters display */}
      {(activeTypeFilter !== "all" || parsedQuery.excluded.length > 0 || parsedQuery.exact) && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 text-xs">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Filters:</span>
          {activeTypeFilter !== "all" && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
              type:{activeTypeFilter}
              <button
                onClick={() => setActiveTypeFilter("all")}
                className="hover:bg-muted-foreground/20 rounded-sm"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          )}
          {parsedQuery.exact && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              exact match
            </Badge>
          )}
          {parsedQuery.excluded.map((excluded) => (
            <Badge
              key={excluded}
              variant="secondary"
              className="text-[10px] px-1.5 py-0 gap-1"
            >
              -{excluded}
            </Badge>
          ))}
        </div>
      )}

      <CommandList>
        <CommandEmpty>
          {isLoading ? "Searching…" : "No results found."}
        </CommandEmpty>

        {/* Search results with grouped display */}
        {hasQuery && groups.length > 0 && (
          <div className="p-1">
            {groups.map((group) => (
              <CommandGroup key={group.type} heading={`${group.label} (${group.total})`}>
                {group.results.map((item) => {
                  const Icon = TYPE_ICONS[item.type] ?? FileText;
                  return (
                    <CommandItem
                      key={`${item.type}-${item.id}`}
                      value={`${item.type} ${item.title} ${item.subtitle ?? ""}`}
                      onSelect={() => handleSelect(item)}
                    >
                      <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span>{item.title}</span>
                        {item.subtitle && (
                          <span className="text-xs text-muted-foreground">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
                {group.has_more && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground text-center border-t">
                    +{group.total - group.results.length} more {group.label.toLowerCase()}
                  </div>
                )}
              </CommandGroup>
            ))}
          </div>
        )}

        {/* Recent items (when no search query) */}
        {!hasQuery && recentItems.length > 0 && (
          <CommandGroup heading="Recent">
            {recentItems.map((item) => {
              const Icon = TYPE_ICONS[item.item_type] ?? Clock;
              return (
                <CommandItem
                  key={`recent-${item.id}`}
                  value={`recent ${item.item_title}`}
                  onSelect={() => handleRecentSelect(item)}
                >
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{item.item_title}</span>
                  <CommandShortcut>
                    {TYPE_LABELS[item.item_type] ?? item.item_type}
                  </CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Recent searches (when no search query) */}
        {!hasQuery && (
          <RecentSearches
            limit={5}
            onSelectSearch={handleRecentSearchSelect}
            showClearAll={true}
            showTimestamps={true}
            showTypeBadge={true}
            showSeparator={false}
          />
        )}

        {/* Actions and navigation (when no search query) */}
        {!hasQuery && (
          <>
            {/* Create actions — role-gated */}
            {user && INTERNAL_ROLES.includes(user.role) && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Actions">
                  {(user.role === "managing_director" || user.role === "relationship_manager") && (
                    <CommandItem
                      value="create new program"
                      onSelect={() => handleAction("/programs/new")}
                    >
                      <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>New Program</span>
                      <CommandShortcut>Action</CommandShortcut>
                    </CommandItem>
                  )}
                  <CommandItem
                    value="create new communication"
                    onSelect={() => handleAction("/communications")}
                  >
                    <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>New Communication</span>
                    <CommandShortcut>Action</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    value="create new escalation"
                    onSelect={() => handleAction("/escalations")}
                  >
                    <AlertTriangle className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>New Escalation</span>
                    <CommandShortcut>Action</CommandShortcut>
                  </CommandItem>
                </CommandGroup>
              </>
            )}

            {/* Config-driven navigation groups */}
            {Object.entries(navGroups).map(([groupLabel, items]) => (
              <Fragment key={groupLabel}>
                <CommandSeparator />
                <CommandGroup heading={groupLabel}>
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={item.href}
                        value={item.searchValue}
                        onSelect={() => handleAction(item.href)}
                      >
                        <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span className={item.isSubItem ? "text-sm text-muted-foreground" : ""}>
                          {item.title}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </Fragment>
            ))}

            {/* Utilities */}
            <CommandSeparator />
            <CommandGroup heading="Utilities">
              <CommandItem
                value="show keyboard shortcuts"
                onSelect={handleShowShortcuts}
              >
                <Keyboard className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Keyboard Shortcuts</span>
                <CommandShortcut>?</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            {/* Search tips */}
            <CommandSeparator />
            <CommandGroup heading="Search Tips">
              <div className="px-2 py-1.5 text-xs text-muted-foreground space-y-1">
                <p>• Use <code className="bg-muted px-1 rounded">type:client</code> to filter by type</p>
                <p>• Use <code className="bg-muted px-1 rounded">&quot;exact phrase&quot;</code> for exact match</p>
                <p>• Use <code className="bg-muted px-1 rounded">-term</code> to exclude results</p>
              </div>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

// Helper function for class name merging
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
