"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Filter,
  Download,
  Calendar,
  Loader2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientTimeline } from "@/hooks/use-client-timeline";
import { TimelineEventCard } from "@/components/clients/timeline-event";
import { cn } from "@/lib/utils";
import type { TimelineEventType, TimelineFilters } from "@/types/client-timeline";

const EVENT_TYPE_OPTIONS: { value: TimelineEventType; label: string }[] = [
  { value: "communication", label: "Communications" },
  { value: "document", label: "Documents" },
  { value: "milestone", label: "Milestones" },
  { value: "program_status", label: "Programs" },
  { value: "approval", label: "Approvals" },
  { value: "compliance", label: "Compliance" },
  { value: "note", label: "Notes" },
];

interface ClientTimelineProps {
  profileId: string;
}

export function ClientTimeline({ profileId }: ClientTimelineProps) {
  const [activeTypes, setActiveTypes] = useState<Set<TimelineEventType>>(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);

  // Build filters from state
  const appliedFilters = useMemo<TimelineFilters>(() => {
    const f: TimelineFilters = {};
    if (activeTypes.size > 0) {
      f.event_types = Array.from(activeTypes);
    }
    if (dateFrom) f.date_from = new Date(dateFrom).toISOString();
    if (dateTo) f.date_to = new Date(dateTo).toISOString();
    return f;
  }, [activeTypes, dateFrom, dateTo]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useClientTimeline(profileId, appliedFilters);

  // Infinite scroll observer
  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  const allEvents = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data]
  );

  const totalCount = data?.pages[0]?.total ?? 0;

  const toggleEventType = (type: TimelineEventType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setActiveTypes(new Set());
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = activeTypes.size > 0 || dateFrom !== "" || dateTo !== "";

  // Group events by date for date markers
  const groupedEvents = useMemo(() => {
    const groups: { date: string; events: typeof allEvents }[] = [];
    let currentDate = "";
    for (const event of allEvents) {
      const eventDate = new Date(event.occurred_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      if (eventDate !== currentDate) {
        currentDate = eventDate;
        groups.push({ date: eventDate, events: [event] });
      } else {
        groups[groups.length - 1].events.push(event);
      }
    }
    return groups;
  }, [allEvents]);

  // Export as CSV
  const handleExport = () => {
    if (allEvents.length === 0) return;
    const headers = ["Date", "Type", "Title", "Description", "Actor"];
    const rows = allEvents.map((e) => [
      new Date(e.occurred_at).toISOString(),
      e.event_type,
      `"${(e.title || "").replace(/"/g, '""')}"`,
      `"${(e.description || "").replace(/"/g, '""')}"`,
      e.actor_name || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `client-timeline-${profileId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Timeline</h2>
          {totalCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalCount} events
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(hasActiveFilters && "border-primary text-primary")}
          >
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            Filters
            {hasActiveFilters && (
              <Badge variant="default" className="ml-1.5 h-5 px-1.5 text-xs">
                {activeTypes.size + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)}
              </Badge>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={allEvents.length === 0}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          {/* Event type filters */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Event Types
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleEventType(opt.value)}
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    activeTypes.has(opt.value)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-accent"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                From
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                To
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load timeline: {(error as Error)?.message || "Unknown error"}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && allEvents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="font-medium text-muted-foreground">No events found</h3>
          <p className="mt-1 text-sm text-muted-foreground/70">
            {hasActiveFilters
              ? "Try adjusting your filters"
              : "Timeline events will appear here as activity occurs"}
          </p>
        </div>
      )}

      {/* Timeline */}
      {!isLoading && allEvents.length > 0 && (
        <div className="space-y-0">
          {groupedEvents.map((group, gi) => (
            <div key={group.date}>
              {/* Date marker */}
              <div className="flex items-center gap-3 py-3">
                <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {group.date}
                  </span>
                </div>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Events in this date group */}
              {group.events.map((event, ei) => {
                const isLastEvent =
                  gi === groupedEvents.length - 1 &&
                  ei === group.events.length - 1;
                return (
                  <TimelineEventCard
                    key={event.id}
                    event={event}
                    isLast={isLastEvent}
                  />
                );
              })}
            </div>
          ))}

          {/* Infinite scroll trigger */}
          <div ref={lastElementRef} className="h-1" />

          {isFetchingNextPage && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading more...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
