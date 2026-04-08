"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutList,
  CheckCircle2,
  FileText,
  MessageSquare,
  Scale,
  Activity,
  CheckCheck,
  ChevronDown,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPortalUpdates,
  markPortalUpdatesAllRead,
  type FeedItem,
  type UpdateType,
  type GetUpdatesParams,
} from "@/lib/api/client-portal";
import { usePortalPrograms } from "@/hooks/use-portal-programs";

// ─── Constants ────────────────────────────────────────────────────────────────

const UPDATE_TYPE_LABELS: Record<UpdateType, string> = {
  program_status: "Program Status",
  milestone_completed: "Milestone Completed",
  document_delivered: "Document Delivered",
  message_received: "Message Received",
  decision_resolved: "Decision Resolved",
};

const UPDATE_TYPE_ICONS: Record<UpdateType, React.ReactNode> = {
  program_status: <Activity className="h-4 w-4 text-blue-500" />,
  milestone_completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  document_delivered: <FileText className="h-4 w-4 text-purple-500" />,
  message_received: <MessageSquare className="h-4 w-4 text-sky-500" />,
  decision_resolved: <Scale className="h-4 w-4 text-orange-500" />,
};

const UPDATE_TYPE_BADGE_CLASSES: Record<UpdateType, string> = {
  program_status: "bg-blue-100 text-blue-700 dark:text-blue-300 dark:bg-blue-900/30",
  milestone_completed: "bg-green-100 text-green-700 dark:text-green-300 dark:bg-green-900/30",
  document_delivered: "bg-purple-100 text-purple-700 dark:text-purple-300 dark:bg-purple-900/30",
  message_received: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  decision_resolved: "bg-orange-100 text-orange-700 dark:text-orange-300 dark:bg-orange-900/30",
};

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

const PAGE_SIZE = 20;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDateRange(value: string): { date_from?: string; date_to?: string } {
  if (value === "all") return {};
  const now = new Date();
  const days = parseInt(value, 10);
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { date_from: from.toISOString() };
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function groupByDate(items: FeedItem[]): Array<{ label: string; items: FeedItem[] }> {
  const now = new Date();
  const groups = new Map<string, FeedItem[]>();

  for (const item of items) {
    const date = new Date(item.timestamp);
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);

    let label: string;
    if (diffDays === 0) label = "Today";
    else if (diffDays === 1) label = "Yesterday";
    else if (diffDays < 7) label = "This week";
    else if (diffDays < 30) label = "This month";
    else label = "Earlier";

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  }

  const order = ["Today", "Yesterday", "This week", "This month", "Earlier"];
  return order
    .filter((l) => groups.has(l))
    .map((label) => ({ label, items: groups.get(label)! }));
}

// ─── Feed Item Component ─────────────────────────────────────────────────────

function FeedItemRow({ item }: { item: FeedItem }) {
  const icon = UPDATE_TYPE_ICONS[item.update_type] ?? (
    <Activity className="h-4 w-4 text-muted-foreground" />
  );
  const badgeClass = UPDATE_TYPE_BADGE_CLASSES[item.update_type] ?? "";
  const typeLabel = UPDATE_TYPE_LABELS[item.update_type] ?? item.update_type;

  return (
    <Link href={item.link}>
      <div
        className={`group flex gap-3 rounded-lg border px-4 py-3 transition-all hover:shadow-sm cursor-pointer ${
          item.is_read
            ? "bg-background border-border"
            : "bg-muted/30 border-l-2 border-l-primary border-border"
        }`}
      >
        {/* Icon */}
        <div className="mt-0.5 shrink-0">{icon}</div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className={`text-sm leading-snug ${
                item.is_read ? "text-foreground" : "font-semibold text-foreground"
              }`}
            >
              {item.title}
            </p>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatTimestamp(item.timestamp)}
            </span>
          </div>

          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{item.description}</p>

          <div className="mt-1.5 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}>
              {typeLabel}
            </span>
            {item.program_title && (
              <span className="text-[11px] text-muted-foreground truncate">
                {item.program_title}
              </span>
            )}
            {!item.is_read && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface WhatsNewFeedProps {
  /** Show compact version without filter controls (for dashboard widget) */
  compact?: boolean;
}

export function WhatsNewFeed({ compact = false }: WhatsNewFeedProps) {
  const queryClient = useQueryClient();
  const { data: programs } = usePortalPrograms();

  const [updateTypeFilter, setUpdateTypeFilter] = React.useState<UpdateType | "all">("all");
  const [programFilter, setProgramFilter] = React.useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = React.useState<string>("all");
  const [page, setPage] = React.useState(0);

  const dateRange = getDateRange(dateRangeFilter);

  const queryParams: GetUpdatesParams = {
    ...(updateTypeFilter !== "all" ? { update_type: updateTypeFilter } : {}),
    ...(programFilter !== "all" ? { program_id: programFilter } : {}),
    ...dateRange,
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["portal", "updates", queryParams],
    queryFn: () => getPortalUpdates(queryParams),
  });

  const markReadMutation = useMutation({
    mutationFn: markPortalUpdatesAllRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["portal", "updates"] });
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const unreadCount = data?.unread_count ?? 0;
  const hasMore = (page + 1) * PAGE_SIZE < total;

  const grouped = groupByDate(items);

  if (compact) {
    // Compact variant for dashboard widget
    return (
      <div className="space-y-1">
        {isLoading ? (
          <p className="text-xs text-muted-foreground py-2">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No recent updates.</p>
        ) : (
          items.slice(0, 5).map((item) => <FeedItemRow key={item.id} item={item} />)
        )}
        {items.length > 5 && (
          <Link href="/portal/updates">
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
              View all updates
            </Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">What&apos;s New</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Recent updates across all your programs
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} unread
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => markReadMutation.mutate()}
            disabled={markReadMutation.isPending || unreadCount === 0}
            className="gap-1.5"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

        {/* Update type filter */}
        <Select
          value={updateTypeFilter}
          onValueChange={(v) => {
            setUpdateTypeFilter(v as UpdateType | "all");
            setPage(0);
          }}
        >
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="All update types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All update types</SelectItem>
            {(Object.keys(UPDATE_TYPE_LABELS) as UpdateType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {UPDATE_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Program filter */}
        {programs && programs.length > 1 && (
          <Select
            value={programFilter}
            onValueChange={(v) => {
              setProgramFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue placeholder="All programs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All programs</SelectItem>
              {programs.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Date range filter */}
        <Select
          value={dateRangeFilter}
          onValueChange={(v) => {
            setDateRangeFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="All time" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Reset */}
        {(updateTypeFilter !== "all" || programFilter !== "all" || dateRangeFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => {
              setUpdateTypeFilter("all");
              setProgramFilter("all");
              setDateRangeFilter("all");
              setPage(0);
            }}
          >
            Reset filters
          </Button>
        )}
      </div>

      {/* Feed content */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <LayoutList className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No updates found.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your filters or check back later.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ label, items: groupItems }) => (
            <section key={label} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </h2>
              <div className="space-y-1.5">
                {groupItems.map((item) => (
                  <FeedItemRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Showing {Math.min(items.length + page * PAGE_SIZE, total)} of {total} updates
            </p>
            <div className="flex items-center gap-2">
              {page > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={isFetching}
                >
                  Previous
                </Button>
              )}
              {hasMore && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={isFetching}
                  className="gap-1.5"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  Load more
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
