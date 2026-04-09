"use client";

import { useSimpleEscalationMetrics } from "@/hooks/use-escalations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock, TrendingUp, CheckCircle } from "lucide-react";

const LEVEL_LABELS: Record<string, string> = {
  task: "Task",
  milestone: "Milestone",
  program: "Program",
  client_impact: "Client Impact",
};

export function EscalationMetrics() {
  const { data, isLoading } = useSimpleEscalationMetrics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-2 h-8 w-16 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const openTotal = Object.values(data.open_by_level).reduce((a, b) => a + b, 0);
  const trendDiff = data.trend_this_week - data.trend_last_week;
  const trendLabel =
    trendDiff > 0
      ? `+${trendDiff} vs last week`
      : trendDiff < 0
        ? `${trendDiff} vs last week`
        : "Same as last week";

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {/* Open by Level */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Open Escalations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{openTotal}</p>
          <div className="mt-1 space-y-0.5">
            {Object.entries(data.open_by_level).map(([level, count]) =>
              count > 0 ? (
                <p key={level} className="text-xs text-muted-foreground">
                  {LEVEL_LABELS[level] ?? level}: {count}
                </p>
              ) : null,
            )}
          </div>
        </CardContent>
      </Card>

      {/* Avg Resolution Time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" />
            Avg Resolution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {data.avg_resolution_time_hours !== null
              ? `${data.avg_resolution_time_hours}h`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Last 30 days</p>
        </CardContent>
      </Card>

      {/* Overdue Count */}
      <Card className={data.overdue_count > 0 ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30" : undefined}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <AlertTriangle
              className={`h-4 w-4 ${data.overdue_count > 0 ? "text-red-500" : ""}`}
            />
            Overdue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={`text-2xl font-bold ${data.overdue_count > 0 ? "text-red-600 dark:text-red-400" : ""}`}
          >
            {data.overdue_count}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Past response deadline</p>
        </CardContent>
      </Card>

      {/* Weekly Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{data.trend_this_week}</p>
          <p
            className={`mt-1 text-xs ${
              trendDiff > 0
                ? "text-red-500"
                : trendDiff < 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-muted-foreground"
            }`}
          >
            {trendLabel}
          </p>
        </CardContent>
      </Card>

      {/* SLA Compliance */}
      {data.sla_compliance_pct !== null && (
        <Card className="col-span-2 md:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              SLA Compliance (last 30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <p
                className={`text-2xl font-bold ${
                  data.sla_compliance_pct >= 90
                    ? "text-green-600 dark:text-green-400"
                    : data.sla_compliance_pct >= 70
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                }`}
              >
                {data.sla_compliance_pct}%
              </p>
              <div className="flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${
                      data.sla_compliance_pct >= 90
                        ? "bg-green-500"
                        : data.sla_compliance_pct >= 70
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${data.sla_compliance_pct}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
