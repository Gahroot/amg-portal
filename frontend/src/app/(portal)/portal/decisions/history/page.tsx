"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  Download,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DecisionHistoryList } from "@/components/portal/decision-history-list";
import { usePortalDecisionHistory } from "@/hooks/use-portal-decisions";
import { buildDecisionHistoryExportUrl } from "@/lib/api/client-portal";
import type { DecisionHistoryParams } from "@/lib/api/client-portal";

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  { value: "responded", label: "Responded" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

export default function DecisionHistoryPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Committed search — only applied when user stops typing (debounce via submit)
  const [committedSearch, setCommittedSearch] = useState("");

  const params: DecisionHistoryParams = {
    ...(committedSearch ? { search: committedSearch } : {}),
    ...(status ? { status } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  };

  const { data, isLoading, isFetching } = usePortalDecisionHistory(params);

  const decisions = data?.decisions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const activeFilterCount = [
    committedSearch,
    status,
    dateFrom,
    dateTo,
  ].filter(Boolean).length;

  const clearFilters = useCallback(() => {
    setSearch("");
    setCommittedSearch("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }, []);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCommittedSearch(search);
    setPage(0);
  }

  function handleFilterChange() {
    setPage(0);
  }

  const exportCsvUrl = buildDecisionHistoryExportUrl({
    ...(committedSearch ? { search: committedSearch } : {}),
    ...(status ? { status } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
    format: "csv",
  });

  const exportXlsxUrl = buildDecisionHistoryExportUrl({
    ...(committedSearch ? { search: committedSearch } : {}),
    ...(status ? { status } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
    format: "xlsx",
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Archive className="h-7 w-7 text-muted-foreground" />
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              Decision Archive
            </h1>
            <p className="text-sm text-muted-foreground">
              Browse your full history of resolved decisions and outcomes
            </p>
          </div>
        </div>
        <Link href="/portal/decisions">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to Decisions
          </Button>
        </Link>
      </div>

      {/* Search + Filter bar */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <form onSubmit={handleSearchSubmit} className="flex min-w-0 flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Search
            </Button>
          </form>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 rounded-full px-1.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          {/* Export menu */}
          <div className="flex shrink-0 gap-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => window.open(exportCsvUrl, "_blank")}
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => window.open(exportXlsxUrl, "_blank")}
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="filter-status" className="text-xs">
                Status
              </Label>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v === "all" ? "" : v);
                  handleFilterChange();
                }}
              >
                <SelectTrigger id="filter-status" className="h-8 text-sm">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-date-from" className="text-xs">
                From date
              </Label>
              <Input
                id="filter-date-from"
                type="date"
                className="h-8 text-sm"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  handleFilterChange();
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-date-to" className="text-xs">
                To date
              </Label>
              <Input
                id="filter-date-to"
                type="date"
                className="h-8 text-sm"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  handleFilterChange();
                }}
              />
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Active filters:</span>
            {committedSearch && (
              <Badge variant="secondary" className="gap-1 text-xs">
                Search: &ldquo;{committedSearch}&rdquo;
                <button
                  onClick={() => {
                    setSearch("");
                    setCommittedSearch("");
                    setPage(0);
                  }}
                  className="ml-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
            {status && (
              <Badge variant="secondary" className="gap-1 text-xs">
                Status: {STATUS_OPTIONS.find((s) => s.value === status)?.label}
                <button
                  onClick={() => {
                    setStatus("");
                    setPage(0);
                  }}
                  className="ml-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
            {dateFrom && (
              <Badge variant="secondary" className="gap-1 text-xs">
                From: {dateFrom}
                <button
                  onClick={() => {
                    setDateFrom("");
                    setPage(0);
                  }}
                  className="ml-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
            {dateTo && (
              <Badge variant="secondary" className="gap-1 text-xs">
                To: {dateTo}
                <button
                  onClick={() => {
                    setDateTo("");
                    setPage(0);
                  }}
                  className="ml-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Results count */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? "No decisions found"
            : `${total} decision${total !== 1 ? "s" : ""} found`}
          {isFetching && !isLoading && (
            <span className="ml-2 text-xs">(updating…)</span>
          )}
        </p>
      )}

      {/* List */}
      <DecisionHistoryList decisions={decisions} isLoading={isLoading} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
