"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useClientProfiles } from "@/hooks/use-clients";
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
import { Search, X, GitCompareArrows } from "lucide-react";
import { DataTableExport } from "@/components/ui/data-table-export";
import type { ExportColumn } from "@/lib/export-utils";
import type { ClientProfile } from "@/types/client";
import { API_BASE_URL } from "@/lib/constants";
import { Checkbox } from "@/components/ui/checkbox";
import { TableSkeleton } from "@/components/ui/loading-skeletons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ClientPreferenceCard } from "@/components/clients/client-preference-card";

const EXPORT_COLUMNS: ExportColumn<ClientProfile>[] = [
  { header: "Display Name", accessor: (r) => r.display_name || r.legal_name },
  { header: "Legal Name", accessor: "legal_name" },
  { header: "Entity Type", accessor: (r) => r.entity_type ?? "" },
  { header: "Email", accessor: "primary_email" },
  { header: "Phone", accessor: (r) => r.phone ?? "" },
  { header: "Compliance Status", accessor: (r) => r.compliance_status.replace(/_/g, " ") },
  { header: "Approval Status", accessor: (r) => r.approval_status.replace(/_/g, " ") },
  { header: "Created", accessor: (r) => new Date(r.created_at).toLocaleDateString() },
];

const INTERNAL_ROLES = [
  "relationship_manager",
  "managing_director",
  "coordinator",
  "finance_compliance",
];

const COMPLIANCE_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  cleared: "default",
  pending_review: "secondary",
  under_review: "secondary",
  flagged: "destructive",
  rejected: "destructive",
};

const APPROVAL_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  approved: "default",
  pending_compliance: "secondary",
  compliance_cleared: "secondary",
  pending_md_approval: "secondary",
  flagged: "destructive",
  rejected: "destructive",
  draft: "outline",
};

function ClientPreferencePopoverCell({
  clientId,
  name,
  onClick,
}: {
  clientId: string;
  name: string;
  onClick: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className="font-medium cursor-pointer hover:underline underline-offset-2"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          {name}
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        side="right"
        align="start"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {open && <ClientPreferenceCard clientId={clientId} compact />}
      </PopoverContent>
    </Popover>
  );
}

function ClientsPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isInternal = user && INTERNAL_ROLES.includes(user.role);

  // Navigation state for scroll and filter preservation
  const {
    _restoreScrollPosition,
    markForRestore,
    resetFilters,
    hasPendingRestore,
  } = useNavigationState({
    routeKey: pathname,
    initialFilters: { compliance_status: "all", approval_status: "all", search: "" },
    restoreScroll: true,
    restoreFilters: true,
  });

  // Track scroll position for restoration
  useScrollTracker(pathname);

  // Restore scroll position after data loads
  useScrollRestore(pathname, !!isInternal && hasPendingRestore);

  // Read initial values from URL
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") ?? ""
  );
  const debouncedSearch = useDebounce(searchInput, 300);

  const complianceStatus = searchParams.get("compliance_status") ?? "all";
  const approvalStatus = searchParams.get("approval_status") ?? "all";

  // Check if any filters are active
  const hasActiveFilters = complianceStatus !== "all" || approvalStatus !== "all" || searchInput !== "";

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

  const { data: savedFiltersData } = useSavedFilters("clients");

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

  const { data, isLoading } = useClientProfiles({
    search: debouncedSearch || undefined,
    compliance_status:
      complianceStatus !== "all" ? complianceStatus : undefined,
    approval_status: approvalStatus !== "all" ? approvalStatus : undefined,
  });

  const { data: bookmarksData } = useBookmarks("client");
  const bookmarkedIds = useMemo(
    () => new Set(bookmarksData?.items.map((b) => b.entity_id) ?? []),
    [bookmarksData]
  );

  const sortedProfiles = useMemo(() => {
    if (!data?.profiles) return [];
    return [...data.profiles].sort((a, b) => {
      const aPin = bookmarkedIds.has(a.id) ? 0 : 1;
      const bPin = bookmarkedIds.has(b.id) ? 0 : 1;
      return aPin - bPin;
    });
  }, [data, bookmarkedIds]);

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
    router.push(`/clients/compare?ids=${ids}`);
  }, [selectedIds, router]);

  // Handle navigation to detail page - mark for restoration
  const handleNavigateToDetail = useCallback(
    (clientId: string) => {
      markForRestore();
      router.push(`/clients/${clientId}`);
    },
    [markForRestore, router]
  );

  // Handle reset filters
  const handleResetFilters = useCallback(() => {
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
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Client Profiles
          </h1>
          <div className="flex items-center gap-2">
            <DataTableExport
              visibleRows={sortedProfiles}
              columns={EXPORT_COLUMNS}
              fileName="clients"
              exportAllUrl={(() => {
                const params = new URLSearchParams();
                if (complianceStatus !== "all") params.set("status", complianceStatus);
                if (debouncedSearch) params.set("search", debouncedSearch);
                const qs = params.toString();
                return `${API_BASE_URL}/api/v1/export/clients${qs ? `?${qs}` : ""}`;
              })()}
            />
            <Button asChild>
              <Link href="/clients/new">New Client</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select
            value={complianceStatus}
            onValueChange={(value) => updateParam("compliance_status", value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Compliance Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="cleared">Cleared</SelectItem>
              <SelectItem value="flagged">Flagged</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={approvalStatus}
            onValueChange={(value) => updateParam("approval_status", value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Approval Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_compliance">
                Pending Compliance
              </SelectItem>
              <SelectItem value="compliance_cleared">
                Compliance Cleared
              </SelectItem>
              <SelectItem value="pending_md_approval">
                Pending MD Approval
              </SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <SavedFiltersDropdown
            entityType="clients"
            currentFilters={{ compliance_status: complianceStatus, approval_status: approvalStatus, search: searchInput }}
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
          <TableSkeleton rows={6} columns={5} />
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Display Name</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Compliance</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProfiles.map((profile) => (
                  <TableRow key={profile.id} className="cursor-pointer">
                    <TableCell
                      className="py-0 px-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.has(profile.id)}
                        onCheckedChange={() => toggleSelection(profile.id)}
                        disabled={!selectedIds.has(profile.id) && selectedIds.size >= 4}
                        aria-label={`Select ${profile.display_name || profile.legal_name}`}
                      />
                    </TableCell>
                    <TableCell
                      className="py-0 px-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <BookmarkButton
                        entityType="client"
                        entityId={profile.id}
                        entityTitle={profile.display_name || profile.legal_name}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <ClientPreferencePopoverCell
                        clientId={profile.id}
                        name={profile.display_name || profile.legal_name}
                        onClick={() => handleNavigateToDetail(profile.id)}
                      />
                    </TableCell>
                    <TableCell
                      onClick={() => handleNavigateToDetail(profile.id)}
                    >
                      {profile.entity_type ?? "-"}
                    </TableCell>
                    <TableCell
                      onClick={() => handleNavigateToDetail(profile.id)}
                    >
                      <Badge
                        variant={
                          COMPLIANCE_STATUS_VARIANT[profile.compliance_status] ??
                          "outline"
                        }
                      >
                        {profile.compliance_status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell
                      onClick={() => handleNavigateToDetail(profile.id)}
                    >
                      <Badge
                        variant={
                          APPROVAL_STATUS_VARIANT[profile.approval_status] ??
                          "outline"
                        }
                      >
                        {profile.approval_status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell
                      onClick={() => handleNavigateToDetail(profile.id)}
                    >
                      {new Date(profile.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {sortedProfiles.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground"
                    >
                      No clients found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <p className="text-sm text-muted-foreground">
            {data.total} client{data.total !== 1 ? "s" : ""} total
          </p>
        )}
      </div>
    </div>
  );
}

export default function ClientsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <TableSkeleton rows={6} columns={5} />
          </div>
        </div>
      }
    >
      <ClientsPageContent />
    </Suspense>
  );
}
