"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { listPartners, getRefreshDuePartners } from "@/lib/api/partners";
import { useDebounce } from "@/hooks/use-debounce";
import {
  useNavigationState,
  useScrollTracker,
  useScrollRestore,
} from "@/hooks/use-navigation-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { BookmarkButton } from "@/components/ui/bookmark-button";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { SavedFiltersDropdown } from "@/components/ui/saved-filters-dropdown";
import { useSavedFilters } from "@/hooks/use-saved-filters";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, AlertTriangle, BarChart3, RefreshCw, ShieldAlert, X } from "lucide-react";
import { DataTableExport } from "@/components/ui/data-table-export";
import type { ExportColumn } from "@/lib/export-utils";
import type { PartnerProfile } from "@/types/partner";
import { API_BASE_URL } from "@/lib/constants";
import { TableSkeleton } from "@/components/ui/loading-skeletons";

const EXPORT_COLUMNS: ExportColumn<PartnerProfile>[] = [
  { header: "Firm Name", accessor: "firm_name" },
  { header: "Contact Name", accessor: "contact_name" },
  { header: "Contact Email", accessor: "contact_email" },
  { header: "Capabilities", accessor: (r) => r.capabilities.join(", ") },
  { header: "Geographies", accessor: (r) => r.geographies.join(", ") },
  { header: "Availability", accessor: (r) => r.availability_status.replace(/_/g, " ") },
  { header: "Rating", accessor: (r) => r.performance_rating != null ? Number(r.performance_rating).toFixed(1) : "" },
  { header: "Status", accessor: (r) => r.status.replace(/_/g, " ") },
  { header: "Probationary", accessor: (r) => r.is_on_probation ? "Yes" : "No" },
];

const INTERNAL_ROLES = [
  "relationship_manager",
  "managing_director",
  "coordinator",
  "finance_compliance",
];

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  inactive: "secondary",
  suspended: "destructive",
  draft: "outline",
};

const AVAILABILITY_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  available: "default",
  busy: "secondary",
  unavailable: "destructive",
};

function PartnersPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isInternal = user && INTERNAL_ROLES.includes(user.role);

  // Compare selection state
  const [compareIds, setCompareIds] = React.useState<Set<string>>(new Set());

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      }
      return next;
    });
  }

  function handleCompare() {
    if (compareIds.size < 2) return;
    router.push(`/partners/compare?ids=${[...compareIds].join(",")}`);
  }

  // Navigation state for scroll and filter preservation
  const {
    restoreScrollPosition,
    markForRestore,
    resetFilters,
    hasPendingRestore,
  } = useNavigationState({
    routeKey: pathname,
    initialFilters: { status: "all", availability: "all", search: "" },
    restoreScroll: true,
    restoreFilters: true,
  });

  // Track scroll position for restoration
  useScrollTracker(pathname);

  // Restore scroll position after data loads
  useScrollRestore(pathname, !!isInternal && hasPendingRestore);

  // Read initial values from URL
  const [searchInput, setSearchInput] = React.useState(
    searchParams.get("search") ?? ""
  );
  const debouncedSearch = useDebounce(searchInput, 300);

  const statusParam = searchParams.get("status") ?? "all";
  const availabilityParam = searchParams.get("availability") ?? "all";

  // Check if any filters are active
  const hasActiveFilters = statusParam !== "all" || availabilityParam !== "all" || searchInput !== "";

  const updateParam = React.useCallback(
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
  React.useEffect(() => {
    updateParam("search", debouncedSearch || undefined);
  }, [debouncedSearch, updateParam]);

  const { data: savedFiltersData } = useSavedFilters("partners");

  // Auto-apply default saved filter when no URL params present
  const hasAppliedDefault = React.useRef(false);
  React.useEffect(() => {
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
    queryKey: ["partners", debouncedSearch, statusParam, availabilityParam],
    queryFn: () =>
      listPartners({
        search: debouncedSearch || undefined,
        status: statusParam !== "all" ? statusParam : undefined,
        availability: availabilityParam !== "all" ? availabilityParam : undefined,
      }),
    enabled: !!user && INTERNAL_ROLES.includes(user.role),
  });

  const { data: refreshDueData } = useQuery({
    queryKey: ["partners", "refresh-due"],
    queryFn: () => getRefreshDuePartners(true),
    enabled: !!user && INTERNAL_ROLES.includes(user.role),
  });

  const overdueCount = refreshDueData?.partners.filter((p) => p.is_overdue).length ?? 0;
  const dueSoonCount = (refreshDueData?.total ?? 0) - overdueCount;
  const probationaryCount = data?.profiles.filter((p) => p.is_on_probation).length ?? 0;

  const { data: bookmarksData } = useBookmarks("partner");
  const bookmarkedIds = React.useMemo(
    () => new Set(bookmarksData?.items.map((b) => b.entity_id) ?? []),
    [bookmarksData]
  );

  const sortedPartners = React.useMemo(() => {
    if (!data?.profiles) return [];
    return [...data.profiles].sort((a, b) => {
      const aPin = bookmarkedIds.has(a.id) ? 0 : 1;
      const bPin = bookmarkedIds.has(b.id) ? 0 : 1;
      return aPin - bPin;
    });
  }, [data?.profiles, bookmarkedIds]);

  // Handle navigation to detail page - mark for restoration
  const handleNavigateToDetail = React.useCallback(
    (partnerId: string) => {
      markForRestore();
      router.push(`/partners/${partnerId}`);
    },
    [markForRestore, router]
  );

  // Handle reset filters
  const handleResetFilters = React.useCallback(() => {
    setSearchInput("");
    router.replace(pathname);
    resetFilters();
  }, [pathname, router, resetFilters]);

  if (!user || !INTERNAL_ROLES.includes(user.role)) {
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
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              Partner Directory
            </h1>
            {overdueCount > 0 && (
              <Badge variant="destructive" className="text-sm">
                {overdueCount} refresh{overdueCount !== 1 ? "es" : ""} overdue
              </Badge>
            )}
            {overdueCount === 0 && dueSoonCount > 0 && (
              <Badge
                variant="secondary"
                className="text-sm bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
              >
                {dueSoonCount} refresh{dueSoonCount !== 1 ? "es" : ""} due soon
              </Badge>
            )}
            {probationaryCount > 0 && (
              <Badge
                variant="outline"
                className="text-sm border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 gap-1"
              >
                <ShieldAlert className="h-3 w-3" />
                {probationaryCount} on probation
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {compareIds.size >= 2 && (
              <Button
                variant="secondary"
                className="gap-1.5"
                onClick={handleCompare}
              >
                <BarChart3 className="h-4 w-4" />
                Compare {compareIds.size}
              </Button>
            )}
            {compareIds.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCompareIds(new Set())}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
            <DataTableExport
              visibleRows={sortedPartners}
              columns={EXPORT_COLUMNS}
              fileName="partners"
              exportAllUrl={(() => {
                const params = new URLSearchParams();
                if (statusParam !== "all") params.set("status", statusParam);
                if (availabilityParam !== "all") params.set("availability", availabilityParam);
                if (debouncedSearch) params.set("search", debouncedSearch);
                const qs = params.toString();
                return `${API_BASE_URL}/api/v1/export/partners${qs ? `?${qs}` : ""}`;
              })()}
            />
            <Button asChild>
              <Link href="/partners/new">New Partner</Link>
            </Button>
          </div>
        </div>

        {/* Overdue Refreshes Alert Section */}
        {refreshDueData && refreshDueData.total > 0 && (
          <Card className={overdueCount > 0 ? "border-red-200 dark:border-red-800 bg-red-50/50" : "border-amber-200 dark:border-amber-800 bg-amber-50/50"}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {overdueCount > 0 ? (
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                ) : (
                  <RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                )}
                <span className={overdueCount > 0 ? "text-red-900 dark:text-red-300" : "text-amber-900 dark:text-amber-300"}>
                  {overdueCount > 0
                    ? `${overdueCount} partner${overdueCount !== 1 ? "s" : ""} with overdue annual refresh`
                    : `${dueSoonCount} partner${dueSoonCount !== 1 ? "s" : ""} with refresh due soon`}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firm</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Last Refreshed</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refreshDueData.partners.map((partner) => (
                    <TableRow
                      key={partner.id}
                      className="cursor-pointer"
                      onClick={() => handleNavigateToDetail(partner.id)}
                    >
                      <TableCell className="font-medium">{partner.firm_name}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{partner.contact_name}</p>
                          <p className="text-xs text-muted-foreground">{partner.contact_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {partner.last_refreshed_at
                          ? new Date(partner.last_refreshed_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        {partner.is_overdue ? (
                          <Badge variant="destructive">Overdue</Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                          >
                            Due in {partner.days_until_due}d
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search partners..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select
            value={statusParam}
            onValueChange={(value) => updateParam("status", value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={availabilityParam}
            onValueChange={(value) => updateParam("availability", value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Availability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="busy">Busy</SelectItem>
              <SelectItem value="unavailable">Unavailable</SelectItem>
            </SelectContent>
          </Select>
          <SavedFiltersDropdown
            entityType="partners"
            currentFilters={{ status: statusParam, availability: availabilityParam, search: searchInput }}
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
            </Button>
          )}
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} columns={7} />
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead className="w-8" title="Select to compare (max 4)">
                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  </TableHead>
                  <TableHead>Firm Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Capabilities</TableHead>
                  <TableHead>Geographies</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPartners.map((partner) => (
                  <TableRow
                    key={partner.id}
                    className={`cursor-pointer ${compareIds.has(partner.id) ? "bg-blue-50/40" : ""}`}
                    onClick={() => handleNavigateToDetail(partner.id)}
                  >
                    <TableCell
                      className="py-0 px-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <BookmarkButton
                        entityType="partner"
                        entityId={partner.id}
                        entityTitle={partner.firm_name}
                        entitySubtitle={partner.contact_name}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell
                      className="py-0 px-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={compareIds.has(partner.id)}
                        onCheckedChange={() => toggleCompare(partner.id)}
                        disabled={
                          !compareIds.has(partner.id) && compareIds.size >= 4
                        }
                        aria-label={`Select ${partner.firm_name} for comparison`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {partner.firm_name}
                        {partner.is_on_probation && (
                          <Badge
                            variant="outline"
                            className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-[10px] px-1.5 py-0 gap-0.5"
                          >
                            <ShieldAlert className="h-2.5 w-2.5" />
                            Probationary
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{partner.contact_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {partner.contact_email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {partner.capabilities.slice(0, 3).map((cap) => (
                          <Badge key={cap} variant="secondary">
                            {cap}
                          </Badge>
                        ))}
                        {partner.capabilities.length > 3 && (
                          <Badge variant="outline">
                            +{partner.capabilities.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {partner.geographies.slice(0, 2).map((geo) => (
                          <Badge key={geo} variant="outline">
                            {geo}
                          </Badge>
                        ))}
                        {partner.geographies.length > 2 && (
                          <Badge variant="outline">
                            +{partner.geographies.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          AVAILABILITY_VARIANT[partner.availability_status] ??
                          "outline"
                        }
                      >
                        {partner.availability_status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {partner.performance_rating != null
                        ? Number(partner.performance_rating).toFixed(1)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          STATUS_VARIANT[partner.status] ?? "outline"
                        }
                      >
                        {partner.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {sortedPartners.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground"
                    >
                      No partners found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <p className="text-sm text-muted-foreground">
            {data.total} partner{data.total !== 1 ? "s" : ""} total
          </p>
        )}
      </div>
    </div>
  );
}

export default function PartnersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <TableSkeleton rows={6} columns={7} />
          </div>
        </div>
      }
    >
      <PartnersPageContent />
    </Suspense>
  );
}
