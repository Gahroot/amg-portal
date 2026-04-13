"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import type { EscalationMetricsSummary } from "@/types/escalation";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ── Summary card ──────────────────────────────────────────────────────────────

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: ReactNode;
  trend?: number | null;
  highlight?: "warn" | "ok" | "neutral";
}

function SummaryCard({ title, value, subtext, icon, trend, highlight }: SummaryCardProps) {
  const borderColor =
    highlight === "warn"
      ? "border-l-amber-500"
      : highlight === "ok"
        ? "border-l-emerald-500"
        : "border-l-border";

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-light tabular-nums tracking-tight">{value}</p>
            {subtext && (
              <p className="text-xs text-muted-foreground">{subtext}</p>
            )}
          </div>
          <div className="ml-3 mt-0.5 text-muted-foreground shrink-0">{icon}</div>
        </div>
        {trend !== undefined && trend !== null && (
          <div
            className={`mt-2 flex items-center gap-1 text-xs font-medium ${
              trend > 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {trend > 0 ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {Math.abs(trend)}% vs prior period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface MetricsSummaryCardsProps {
  summary: EscalationMetricsSummary | undefined;
  isLoading: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MetricsSummaryCards({ summary, isLoading }: MetricsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))
      ) : (
        <>
          <SummaryCard
            title="Total Escalations"
            value={summary?.total ?? 0}
            icon={<AlertTriangle className="h-5 w-5" />}
            trend={summary?.change_vs_prior_period_pct}
            subtext={`${summary?.prior_period_total ?? 0} prior period`}
          />
          <SummaryCard
            title="Open"
            value={summary?.open ?? 0}
            icon={<Clock className="h-5 w-5 text-amber-500" />}
            highlight={
              summary && summary.total > 0 && summary.open / summary.total > 0.5
                ? "warn"
                : "neutral"
            }
            subtext={
              summary && summary.total > 0
                ? `${Math.round((summary.open / summary.total) * 100)}% of total`
                : undefined
            }
          />
          <SummaryCard
            title="Avg Resolution Time"
            value={
              summary?.avg_resolution_hours !== null &&
              summary?.avg_resolution_hours !== undefined
                ? `${summary.avg_resolution_hours}h`
                : "—"
            }
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            highlight={
              summary?.avg_resolution_hours !== null &&
              summary?.avg_resolution_hours !== undefined
                ? summary.avg_resolution_hours > 72
                  ? "warn"
                  : "ok"
                : "neutral"
            }
          />
          <SummaryCard
            title="Avg Time to Response"
            value={
              summary?.avg_time_to_response_hours !== null &&
              summary?.avg_time_to_response_hours !== undefined
                ? `${summary.avg_time_to_response_hours}h`
                : "—"
            }
            icon={<TrendingUp className="h-5 w-5 text-primary" />}
            highlight={
              summary?.avg_time_to_response_hours !== null &&
              summary?.avg_time_to_response_hours !== undefined
                ? summary.avg_time_to_response_hours > 24
                  ? "warn"
                  : "ok"
                : "neutral"
            }
          />
        </>
      )}
    </div>
  );
}
