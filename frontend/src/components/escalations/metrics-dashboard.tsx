"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import { getEscalationMetrics } from "@/lib/api/escalations";
import type {
  EscalationByLevel,
  EscalationDetailedMetrics,
  EscalationMetricsParams,
} from "@/types/escalation";
import { downloadFile } from "@/lib/export-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricsFilterPanel, LEVEL_LABELS, STATUS_LABELS, type DatePreset } from "./metrics-filter-panel";
import { MetricsSummaryCards } from "./metrics-summary-cards";
import { EscalationLevelChart, LEVEL_COLORS, STATUS_COLORS, type LevelChartEntry } from "./escalation-level-chart";
import { EscalationTrendChart } from "./escalation-trend-chart";

// ── Helpers ───────────────────────────────────────────────────────────────────

function presetToDates(preset: DatePreset): { from: Date; to: Date } {
  const to = new Date();
  const days = preset === "30d" ? 30 : preset === "90d" ? 90 : preset === "180d" ? 180 : 365;
  return { from: subDays(to, days), to };
}

function exportMetricsCsv(metrics: EscalationDetailedMetrics, params: EscalationMetricsParams) {
  function esc(v: string) { return `"${v.replace(/"/g, '""')}"`; }
  const lines: string[] = [
    "# Escalation Metrics Export",
    `"Date From","${params.date_from ?? "—"}"`,
    `"Date To","${params.date_to ?? "—"}"`,
    "",
    "## Summary",
    `"Total","${metrics.summary.total}"`,
    `"Open","${metrics.summary.open}"`,
    `"Resolved","${metrics.summary.resolved}"`,
    `"Avg Resolution (h)","${metrics.summary.avg_resolution_hours ?? "—"}"`,
    `"Avg Time to Response (h)","${metrics.summary.avg_time_to_response_hours ?? "—"}"`,
    "",
    '"Level","Count"',
    ...metrics.by_level.map((r) => `${esc(LEVEL_LABELS[r.level] ?? r.level)},"${r.count}"`),
    "",
    '"Status","Count"',
    ...metrics.by_status.map((r) => `${esc(STATUS_LABELS[r.status] ?? r.status)},"${r.count}"`),
    "",
    '"Week","Task","Milestone","Program","Client Impact","Total"',
    ...metrics.trend.map((r) => `"${r.week}","${r.task}","${r.milestone}","${r.program}","${r.client_impact}","${r.total}"`),
  ];
  downloadFile(lines.join("\n"), "escalation-metrics.csv", "text/csv");
}

// ── Main component ────────────────────────────────────────────────────────────

export function EscalationMetricsDashboard() {
  const [preset, setPreset] = useState<DatePreset>("90d");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { from, to } = presetToDates(preset);
  const params: EscalationMetricsParams = {
    date_from: from.toISOString(),
    date_to: to.toISOString(),
    level: levelFilter !== "all" ? levelFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  };

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["escalation-metrics", params],
    queryFn: () => getEscalationMetrics(params),
    staleTime: 2 * 60 * 1000,
  });

  const levelChartData = useMemo<LevelChartEntry[]>(
    () => data?.by_level.map((b: EscalationByLevel) => ({ name: LEVEL_LABELS[b.level] ?? b.level, count: b.count, fill: LEVEL_COLORS[b.level] ?? "#94a3b8" })) ?? [],
    [data],
  );

  const statusChartData = useMemo<LevelChartEntry[]>(
    () => data?.by_status.map((b) => ({ name: STATUS_LABELS[b.status] ?? b.status, count: b.count, fill: STATUS_COLORS[b.status] ?? "#94a3b8" })) ?? [],
    [data],
  );

  return (
    <div className="space-y-6">
      <MetricsFilterPanel
        preset={preset}
        levelFilter={levelFilter}
        statusFilter={statusFilter}
        isFetching={isFetching}
        canExport={!!data}
        onPresetChange={setPreset}
        onLevelChange={setLevelFilter}
        onStatusChange={setStatusFilter}
        onRefresh={() => refetch()}
        onExport={() => data && exportMetricsCsv(data, params)}
      />

      {isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load metrics. Please try refreshing.
        </div>
      )}

      <MetricsSummaryCards summary={data?.summary} isLoading={isLoading} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EscalationLevelChart data={levelChartData} isLoading={isLoading} title="Escalations by Level" />
        <EscalationLevelChart data={statusChartData} isLoading={isLoading} title="Escalations by Status" />
      </div>

      <EscalationTrendChart data={data?.trend ?? []} isLoading={isLoading} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">Top Assignees by Volume</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : !data?.by_assignee.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No assignee data</p>
            ) : (
              <div className="space-y-2">
                {data.by_assignee.slice(0, 6).map((a) => {
                  const maxCount = data.by_assignee[0]?.count ?? 1;
                  const pct = Math.round((a.count / maxCount) * 100);
                  return (
                    <div key={a.owner_id} className="flex items-center gap-3">
                      <div className="w-28 shrink-0 truncate text-xs font-medium">
                        {a.owner_name ?? a.owner_email ?? a.owner_id.slice(0, 8)}
                      </div>
                      <div className="flex-1 rounded-full bg-muted h-2 overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground w-6 text-right">{a.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Recurring Escalations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !data?.recurring_patterns.length ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No recurring escalations in this period.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {data.recurring_patterns.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium capitalize">{p.entity_type}</span>
                      <span className="text-muted-foreground text-xs ml-2">{p.entity_id.slice(0, 8)}…</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge variant="outline" className="text-[10px] capitalize" style={{ borderColor: LEVEL_COLORS[p.level], color: LEVEL_COLORS[p.level] }}>
                        {LEVEL_LABELS[p.level] ?? p.level}
                      </Badge>
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">×{p.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(data?.insights?.length ?? 0) > 0 && (
        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <Lightbulb className="h-4 w-4" />
              Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data?.insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-300">
                  <span className="mt-0.5 h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                  {insight}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
