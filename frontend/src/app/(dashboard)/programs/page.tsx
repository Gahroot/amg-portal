"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { listPrograms } from "@/lib/api/programs";
import { useDebounce } from "@/hooks/use-debounce";
import {
  useNavigationState,
  useScrollTracker,
  useScrollRestore,
} from "@/hooks/use-navigation-state";
import type { ProgramStatus } from "@/types/program";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/programs/status-badge";
import { RagBadge } from "@/components/programs/rag-badge";
import { BookmarkButton } from "@/components/ui/bookmark-button";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { SavedFiltersDropdown } from "@/components/ui/saved-filters-dropdown";
import { useSavedFilters } from "@/hooks/use-saved-filters";
import { Search, X, GitCompareArrows } from "lucide-react";
import { DataTableExport } from "@/components/ui/data-table-export";
import type { ExportColumn } from "@/lib/export-utils";
import type { Program } from "@/types/program";
import { API_BASE_URL } from "@/lib/constants";
import { Checkbox } from "@/components/ui/checkbox";
import { TableSkeleton } from "@/components/ui/loading-skeletons";

const EXPORT_COLUMNS: ExportColumn<Program>[] = [
  { header: "Title", accessor: "title" },
  { header: "Client", accessor: "client_name" },
  { header: "Status", accessor: "status" },
  { header: "RAG Status", accessor: "rag_status" },
  { header: "Start Date", accessor: (r) => r.start_date ? new Date(r.start_date).toLocaleDateString() : "" },
  { header: "End Date", accessor: (r) => r.end_date ? new Date(r.end_date).toLocaleDateString() : "" },
  { header: "Milestones", accessor: "milestone_count" },
  { header: "Completed Milestones", accessor: "completed_milestone_count" },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "intake", label: "Intake" },
  { value: "design", label: "Design" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
];

function ProgramsPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isInternal = user?.role !== "client" && user?.role !== "partner";

  // Navigation state for scroll and filter preservation
  const {
    _isRestored,
    restoreScrollPosition,
    markForRestore,
    resetFilters,
    hasPendingRestore,
  } = useNavigationState({
    routeKey: pathname,
    initialFilters: { status: "all", search: "" },
    restoreScroll: true,
    restoreFilters: true,
  });

  // Track scroll position for restoration
  useScrollTracker(pathname);
  
  // Restore scroll position after data loads
  useScrollRestore(pathname, !isInternal === false && hasPendingRestore);

  // Read initial values from URL (or restored state)
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") ?? ""
  );
  const debouncedSearch = useDebounce(searchInput, 300);

  const statusParam = searchParams.get("status") ?? "all";

  // Check if any filters are active
  const hasActiveFilters = statusParam !== "all" || searchInput !== "";

  const updateParam = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  // Sync debounced search to URL
  useEffect(() => {
    updateParam("search", debouncedSearch || undefined);
  }, [debouncedSearch, updateParam]);

  // Restore scroll after data loads
  useEffect(() => {
    if (!isInternal && hasPendingRestore) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        restoreScrollPosition();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isInternal, hasPendingRestore, restoreScrollPosition]);

  const { data: savedFiltersData } = useSavedFilters("programs");

  // Auto-apply default saved filter when no URL params present
  const hasAppliedDefault = useRef(false);
  useEffect(() => {
    if (hasAppliedDefault.current) return;
    if (!savedFiltersData?.items) return;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.toString()) return;
    const defaultFilter = savedFiltersData.items.find((f) => f.is_default);
    if (defaultFilter) {
      hasAppliedDefault.current = true;
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(defaultFilter.filter_config)) {
        if (value && value !== "all") params.set(key, value);
      }
      if (defaultFilter.filter_config.search) {
        setSearchInput(defaultFilter.filter_config.search);
      }
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [savedFiltersData, pathname, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["programs", statusParam, debouncedSearch],
    queryFn: () =>
      listPrograms({
        status: statusParam !== "all" ? (statusParam as ProgramStatus) : undefined,
        search: debouncedSearch || undefined,
      }),
    enabled: isInternal,
  });

  const { data: bookmarksData } = useBookmarks("program");
  const bookmarkedIds = useMemo(
    () => new Set(bookmarksData?.items.map((b) => b.entity_id) ?? []),
    [bookmarksData]
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleCompare = useCallback(() => {
    const ids = Array.from(selectedIds).join(",");
    router.push(`/programs/compare?ids=${ids}`);
  }, [selectedIds, router]);

  const sortedPrograms = useMemo(() => {
    if (!data?.programs) return [];
    return [...data.programs].sort((a, b) => {
      const aPin = bookmarkedIds.has(a.id) ? 0 : 1;
      const bPin = bookmarkedIds.has(b.id) ? 0 : 1;
      return aPin - bPin;
    });
  }, [data, bookmarkedIds]);

  // Handle navigation to detail page - mark for restoration
  const handleNavigateToDetail = useCallback(
    (programId: string) => {
      markForRestore();
      router.push(`/programs/${programId}`);
    },
    [markForRestore, router]
  );

  // Handle reset filters
  const handleResetFilters = useCallback(() => {
    setSearchInput("");
    router.replace(pathname);
    resetFilters();
  }, [pathname, router, resetFilters]);

  if (!isInternal) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Programs
          </h1>
          <div className="flex items-center gap-2">
            <DataTableExport
              visibleRows={sortedPrograms}
              columns={EXPORT_COLUMNS}
              fileName="programs"
              exportAllUrl={(() => {
                const params = new URLSearchParams();
                if (statusParam !== "all") params.set("status", statusParam);
                if (debouncedSearch) params.set("search", debouncedSearch);
                const qs = params.toString();
                return `${API_BASE_URL}/api/v1/export/programs${qs ? `?${qs}` : ""}`;
              })()}
            />
            <Button asChild>
              <Link href="/programs/new">New Program</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search programs..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select
            value={statusParam}
            onValueChange={(value) => updateParam("status", value)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SavedFiltersDropdown
            entityType="programs"
            currentFilters={{ status: statusParam, search: searchInput }}
            onApplyFilter={(config) => {
              const params = new URLSearchParams();
              for (const [key, value] of Object.entries(config)) {
                if (key === "search") {
                  setSearchInput(value || "");
                } else if (value && value !== "all") {
                  params.set(key, value);
                }
              }
              if (config.search) params.set("search", config.search);
              router.replace(`${pathname}?${params.toString()}`);
            }}
          />
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="gap-1.5"
            >
              <X className="h-4 w-4" />
              Reset Filters
            </Button>
          )}
          {selectedIds.size >= 2 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleCompare}
              className="gap-1.5"
            >
              <GitCompareArrows className="h-4 w-4" />
              Compare ({selectedIds.size})
            </Button>
          )}
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Title</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>RAG</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPrograms.map((program) => (
                  <TableRow key={program.id}>
                    <TableCell className="py-0 px-2">
                      <Checkbox
                        checked={selectedIds.has(program.id)}
                        onCheckedChange={() => toggleSelection(program.id)}
                        disabled={!selectedIds.has(program.id) && selectedIds.size >= 4}
                        aria-label={`Select ${program.title}`}
                      />
                    </TableCell>
                    <TableCell className="py-0 px-2">
                      <BookmarkButton
                        entityType="program"
                        entityId={program.id}
                        entityTitle={program.title}
                        entitySubtitle={program.client_name}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <button
                        onClick={() => handleNavigateToDetail(program.id)}
                        className="hover:underline text-left"
                      >
                        {program.title}
                      </button>
                    </TableCell>
                    <TableCell>{program.client_name}</TableCell>
                    <TableCell>
                      <StatusBadge status={program.status} />
                    </TableCell>
                    <TableCell>
                      <RagBadge status={program.rag_status} />
                    </TableCell>
                    <TableCell>
                      {program.start_date
                        ? new Date(program.start_date).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {program.end_date
                        ? new Date(program.end_date).toLocaleDateString()
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {sortedPrograms.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground"
                    >
                      No programs found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <p className="text-sm text-muted-foreground">
            {data.total} program{data.total !== 1 ? "s" : ""} total
          </p>
        )}
      </div>
    </div>
  );
}

export default function ProgramsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <TableSkeleton rows={6} columns={6} />
          </div>
        </div>
      }
    >
      <ProgramsPageContent />
    </Suspense>
  );
}
