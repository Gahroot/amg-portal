"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO, subDays } from "date-fns";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Download,
  Lightbulb,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { getEscalationMetrics } from "@/lib/api/escalations";
import type {
  EscalationByLevel,
  EscalationMetrics,
  EscalationMetricsParams,
  EscalationTrendPoint,
} from "@/types/escalation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

// ── Constants ────────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  task: "#6366f1",
  milestone: "#f59e0b",
  program: "#ef4444",
  client_impact: "#dc2626",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#ef4444",
  acknowledged: "#f59e0b",
  investigating: "#6366f1",
  resolved: "#16a34a",
  closed: "#94a3b8",
};

const LEVEL_LABELS: Record<string, string> = {
  task: "Task",
  milestone: "Milestone",
  program: "Program",
  client_impact: "Client Impact",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  investigating: "Investigating",
  resolved: "Resolved",
  closed: "Closed",
};

type DatePreset = "30d" | "90d" | "180d" | "365d" | "custom";

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "180d", label: "Last 6 months" },
  { value: "365d", label: "Last year" },
];

// ── Helper: date range from preset ───────────────────────────────────────────

function presetToDates(preset: DatePreset): { from: Date; to: Date } {
  const to = new Date();
  const days = preset === "30d" ? 30 : preset === "90d" ? 90 : preset === "180d" ? 180 : 365;
  return { from: subDays(to, days), to };
}

// ── Summary card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
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
              trend > 0 ? "text-red-500" : "text-emerald-600"
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

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  labelFormatter?: (v: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const displayLabel = label
    ? labelFormatter
      ? labelFormatter(label)
      : label
    : "";
  return (
    <div className="rounded-lg border bg-background shadow-md p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold mb-2">{displayLabel}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}
          </span>
          <span className="font-medium tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Export CSV helper ─────────────────────────────────────────────────────────

function exportMetricsCsv(metrics: EscalationMetrics, params: EscalationMetricsParams) {
  const rows: string[][] = [];

  rows.push(["# Escalation Metrics Export"]);
  rows.push(["Date From", params.date_from ?? "—"]);
  rows.push(["Date To", params.date_to ?? "—"]);
  rows.push([]);

  rows.push(["## Summary"]);
  rows.push(["Total", String(metrics.summary.total)]);
  rows.push(["Open", String(metrics.summary.open)]);
  rows.push(["Resolved", String(metrics.summary.resolved)]);
  rows.push([
    "Avg Resolution (h)",
    metrics.summary.avg_resolution_hours !== null
      ? String(metrics.summary.avg_resolution_hours)
      : "—",
  ]);
  rows.push([
    "Avg Time to Response (h)",
    metrics.summary.avg_time_to_response_hours !== null
      ? String(metrics.summary.avg_time_to_response_hours)
      : "—",
  ]);
  rows.push([]);

  rows.push(["## By Level", "Count"]);
  for (const r of metrics.by_level) {
    rows.push([LEVEL_LABELS[r.level] ?? r.level, String(r.count)]);
  }
  rows.push([]);

  rows.push(["## By Status", "Count"]);
  for (const r of metrics.by_status) {
    rows.push([STATUS_LABELS[r.status] ?? r.status, String(r.count)]);
  }
  rows.push([]);

  rows.push(["## Weekly Trend", "Task", "Milestone", "Program", "Client Impact", "Total"]);
  for (const r of metrics.trend) {
    rows.push([r.week, String(r.task), String(r.milestone), String(r.program), String(r.client_impact), String(r.total)]);
  }

  const content = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "escalation-metrics.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────────────────────

export function EscalationMetricsDashboard() {
  const [preset, setPreset] = React.useState<DatePreset>("90d");
  const [levelFilter, setLevelFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

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

  // Level bar chart data
  const levelChartData = React.useMemo(
    () =>
      data?.by_level.map((b: EscalationByLevel) => ({
        name: LEVEL_LABELS[b.level] ?? b.level,
        count: b.count,
        fill: LEVEL_COLORS[b.level] ?? "#94a3b8",
      })) ?? [],
    [data],
  );

  // Status bar chart data
  const statusChartData = React.useMemo(
    () =>
      data?.by_status.map((b) => ({
        name: STATUS_LABELS[b.status] ?? b.status,
        count: b.count,
        fill: STATUS_COLORS[b.status] ?? "#94a3b8",
      })) ?? [],
    [data],
  );

  // Trend line chart data
  const trendData = React.useMemo(
    () =>
      data?.trend.map((t: EscalationTrendPoint) => ({
        ...t,
        label: t.week,
      })) ?? [],
    [data],
  );

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* ── Header + filters ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Escalation Metrics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Resolution time, frequency, and trend analysis
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Date preset */}
          <div className="flex rounded-md border overflow-hidden">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  preset === p.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Level filter */}
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {Object.entries(LEVEL_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[145px] h-8 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {data && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMetricsCsv(data, params)}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export
            </Button>
          )}
        </div>
      </div>

      {isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load metrics. Please try refreshing.
        </div>
      )}

      {/* ── Summary cards ── */}
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
              icon={<TrendingUp className="h-5 w-5 text-indigo-500" />}
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

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* By Level */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">
              Escalations by Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : levelChartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                No data
              </div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={levelChartData}
                    margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                      {levelChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">
              Escalations by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : statusChartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                No data
              </div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={statusChartData}
                    margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                      {statusChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Trend chart ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            Weekly Escalation Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : trendData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
              No trend data for this period.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendData}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => {
                      try {
                        return format(parseISO(v), "MMM d");
                      } catch {
                        return v;
                      }
                    }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        labelFormatter={(v) => {
                          try {
                            return `Week of ${format(parseISO(v), "MMM d, yyyy")}`;
                          } catch {
                            return v;
                          }
                        }}
                      />
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="4 2"
                  />
                  <Line
                    type="monotone"
                    dataKey="task"
                    name="Task"
                    stroke={LEVEL_COLORS.task}
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="milestone"
                    name="Milestone"
                    stroke={LEVEL_COLORS.milestone}
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="program"
                    name="Program"
                    stroke={LEVEL_COLORS.program}
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="client_impact"
                    name="Client Impact"
                    stroke={LEVEL_COLORS.client_impact}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Bottom row: Assignees + Recurring ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top assignees */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">
              Top Assignees by Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : !data?.by_assignee.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No assignee data
              </p>
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
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground w-6 text-right">
                        {a.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recurring patterns */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Recurring Escalations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !data?.recurring_patterns.length ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No recurring escalations in this period.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {data.recurring_patterns.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-medium capitalize">{p.entity_type}</span>
                      <span className="text-muted-foreground text-xs ml-2">
                        {p.entity_id.slice(0, 8)}…
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize"
                        style={{
                          borderColor: LEVEL_COLORS[p.level],
                          color: LEVEL_COLORS[p.level],
                        }}
                      >
                        {LEVEL_LABELS[p.level] ?? p.level}
                      </Badge>
                      <span className="text-xs font-bold text-amber-600">
                        ×{p.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Insights ── */}
      {(data?.insights?.length ?? 0) > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base flex items-center gap-2 text-amber-800">
              <Lightbulb className="h-4 w-4" />
              Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data?.insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
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
