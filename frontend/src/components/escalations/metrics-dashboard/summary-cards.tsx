"use client";

import { AlertTriangle, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { EscalationDetailedMetrics } from "@/types/escalation";
import { SummaryCard } from "./summary-card";

interface SummaryCardsProps {
  isLoading: boolean;
  summary: EscalationDetailedMetrics["summary"] | undefined;
}

export function SummaryCards({ isLoading, summary }: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
    </div>
  );
}
