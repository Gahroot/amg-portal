"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Download, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PartnerTrends, TrendDataPoint, TrendAnnotation } from "@/types/partner";

// ─── Types ────────────────────────────────────────────────────────────────────

type DateRange = 30 | 90 | 365;

type MetricKey =
  | "sla_compliance_pct"
  | "avg_quality"
  | "avg_timeliness"
  | "avg_communication"
  | "avg_overall"
  | "assignments_completed";

interface MetricConfig {
  key: MetricKey;
  label: string;
  color: string;
  type: "line" | "bar";
  domain?: [number, number];
  yAxisId?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const METRICS: MetricConfig[] = [
  {
    key: "sla_compliance_pct",
    label: "SLA Compliance %",
    color: "#8b7d5e",
    type: "line",
    domain: [0, 100],
    yAxisId: "pct",
  },
  {
    key: "avg_overall",
    label: "Overall Rating",
    color: "#1B2A4A",
    type: "line",
    domain: [1, 5],
    yAxisId: "score",
  },
  {
    key: "avg_quality",
    label: "Quality",
    color: "#c4a060",
    type: "line",
    domain: [1, 5],
    yAxisId: "score",
  },
  {
    key: "avg_timeliness",
    label: "Timeliness",
    color: "#6B5E4A",
    type: "line",
    domain: [1, 5],
    yAxisId: "score",
  },
  {
    key: "avg_communication",
    label: "Communication",
    color: "#A0785A",
    type: "line",
    domain: [1, 5],
    yAxisId: "score",
  },
  {
    key: "assignments_completed",
    label: "Assignments Completed",
    color: "#D4CFC5",
    type: "bar",
    yAxisId: "count",
  },
];

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
];

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number | null; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-t-2 border-t-primary bg-background shadow-md p-3 text-xs space-y-1 min-w-[180px]">
      <p className="font-semibold text-foreground mb-2">
        Week of {label ? format(parseISO(label), "MMM d, yyyy") : ""}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}
          </span>
          <span className="font-medium tabular-nums">
            {entry.value !== null && entry.value !== undefined
              ? entry.name.includes("%")
                ? `${entry.value.toFixed(1)}%`
                : entry.name.includes("Rating") ||
                    entry.name.includes("Quality") ||
                    entry.name.includes("Timeliness") ||
                    entry.name.includes("Communication")
                  ? entry.value.toFixed(2)
                  : String(entry.value)
              : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Annotation legend ────────────────────────────────────────────────────────

function AnnotationBadge({ ann }: { ann: TrendAnnotation }) {
  const color =
    ann.event_type === "governance"
      ? "destructive"
      : ann.severity === "critical"
        ? "destructive"
        : ann.severity === "major"
          ? "secondary"
          : "outline";
  return (
    <div className="flex items-center gap-2 text-xs">
      <Badge variant={color as "destructive" | "secondary" | "outline"} className="text-[10px]">
        {format(parseISO(ann.date), "MMM d")}
      </Badge>
      <span className="text-muted-foreground">{ann.label}</span>
    </div>
  );
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number | null;
  unit?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold" style={{ color: color ?? "inherit" }}>
        {value !== null && value !== undefined ? `${value.toFixed(1)}${unit ?? ""}` : "—"}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PerformanceChartProps {
  trends: PartnerTrends | undefined;
  isLoading: boolean;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  /** If true, governance/notice annotations are hidden (for partner self-view) */
  hideAnnotations?: boolean;
}

export function PerformanceChart({
  trends,
  isLoading,
  dateRange,
  onDateRangeChange,
  hideAnnotations = false,
}: PerformanceChartProps) {
  const chartRef = React.useRef<HTMLDivElement>(null);

  // Metric visibility toggles
  const [visibleMetrics, setVisibleMetrics] = React.useState<Set<MetricKey>>(
    new Set(["sla_compliance_pct", "avg_overall", "avg_quality"])
  );

  function toggleMetric(key: MetricKey) {
    setVisibleMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Always keep at least one visible
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  // Export chart as PNG
  async function handleExport() {
    if (!chartRef.current) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(chartRef.current, { backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `partner-performance-${dateRange}d.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // Fallback: open chart container in a new tab for manual saving
      window.print();
    }
  }

  // Map annotations to reference-line dates (week keys)
  const annotationDates = React.useMemo(() => {
    if (!trends?.annotations?.length || hideAnnotations) return new Map<string, TrendAnnotation>();
    const map = new Map<string, TrendAnnotation>();
    for (const ann of trends.annotations) {
      // Find the closest week_start
      const annDate = parseISO(ann.date);
      const weekStart = trends.data_points.reduce(
        (closest: string | null, dp) => {
          if (!closest) return dp.week_start;
          const closestDiff = Math.abs(parseISO(closest).getTime() - annDate.getTime());
          const dpDiff = Math.abs(parseISO(dp.week_start).getTime() - annDate.getTime());
          return dpDiff < closestDiff ? dp.week_start : closest;
        },
        null
      );
      if (weekStart) map.set(weekStart, ann);
    }
    return map;
  }, [trends, hideAnnotations]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!trends) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No trend data available.</p>
        </CardContent>
      </Card>
    );
  }

  const { summary, data_points: dataPoints, annotations } = trends;

  // Recharts data — fill null gaps with null (not 0) for graceful line breaks
  const chartData = dataPoints.map((dp) => ({
    ...dp,
    label: dp.week_start,
  }));

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="SLA Compliance"
          value={summary.overall_sla_compliance_pct}
          unit="%"
          color={
            summary.overall_sla_compliance_pct !== null
              ? summary.overall_sla_compliance_pct >= 90
                ? "#4A7A5A"
                : summary.overall_sla_compliance_pct >= 75
                  ? "#c4a060"
                  : "#8B2020"
              : undefined
          }
        />
        <SummaryCard
          label="Avg Quality Rating"
          value={summary.overall_avg_quality}
          color={
            summary.overall_avg_quality !== null
              ? summary.overall_avg_quality >= 4
                ? "#4A7A5A"
                : summary.overall_avg_quality >= 3
                  ? "#c4a060"
                  : "#8B2020"
              : undefined
          }
        />
        <SummaryCard
          label="Completed Assignments"
          value={summary.total_completed_assignments}
        />
        <SummaryCard
          label="Completion Rate"
          value={summary.completion_rate_pct}
          unit="%"
        />
      </div>

      {/* Chart controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Performance Trends
            </CardTitle>

            <div className="flex items-center gap-2">
              {/* Date range selector */}
              <div className="flex items-center rounded-md border overflow-hidden">
                {DATE_RANGES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => onDateRangeChange(r.value)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      dateRange === r.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Export */}
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-3.5 w-3.5 mr-1" />
                Export
              </Button>
            </div>
          </div>

          {/* Metric toggles */}
          <div className="flex flex-wrap gap-2 pt-2">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => toggleMetric(m.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all border ${
                  visibleMetrics.has(m.key)
                    ? "border-transparent text-white"
                    : "border-border bg-transparent text-muted-foreground opacity-50"
                }`}
                style={
                  visibleMetrics.has(m.key)
                    ? { backgroundColor: m.color, borderColor: m.color }
                    : {}
                }
              >
                {m.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {dataPoints.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                No data for this period.
              </p>
            </div>
          ) : (
            <div ref={chartRef} className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="1 4" strokeOpacity={0.4} stroke="hsl(var(--border))" vertical={false} />

                  {/* X axis — week start dates */}
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
                    interval={dateRange === 30 ? 0 : dateRange === 90 ? 1 : 3}
                  />

                  {/* Y axis: percentage (0-100) */}
                  {visibleMetrics.has("sla_compliance_pct") && (
                    <YAxis
                      yAxisId="pct"
                      orientation="left"
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `${v}%`}
                      width={36}
                    />
                  )}

                  {/* Y axis: score (1-5) */}
                  {METRICS.filter(
                    (m) => m.yAxisId === "score" && visibleMetrics.has(m.key)
                  ).length > 0 && (
                    <YAxis
                      yAxisId="score"
                      orientation={
                        visibleMetrics.has("sla_compliance_pct") ? "right" : "left"
                      }
                      domain={[1, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={24}
                    />
                  )}

                  {/* Y axis: count */}
                  {visibleMetrics.has("assignments_completed") && (
                    <YAxis
                      yAxisId="count"
                      orientation="right"
                      allowDecimals={false}
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={24}
                    />
                  )}

                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    iconType="circle"
                    iconSize={8}
                  />

                  {/* Annotation reference lines */}
                  {Array.from(annotationDates.entries()).map(([weekStart, ann]) => (
                    <ReferenceLine
                      key={`${weekStart}-${ann.label}`}
                      x={weekStart}
                      yAxisId={
                        visibleMetrics.has("sla_compliance_pct") ? "pct" : "score"
                      }
                      stroke={
                        ann.event_type === "governance"
                          ? "#dc2626"
                          : ann.severity === "critical"
                            ? "#dc2626"
                            : "#d97706"
                      }
                      strokeDasharray="4 2"
                      label={{
                        value: ann.label,
                        fontSize: 9,
                        fill: "#6b7280",
                        position: "insideTopLeft",
                      }}
                    />
                  ))}

                  {/* Metric lines/bars */}
                  {METRICS.map((m) => {
                    if (!visibleMetrics.has(m.key)) return null;
                    if (m.type === "bar") {
                      return (
                        <Bar
                          key={m.key}
                          dataKey={m.key}
                          name={m.label}
                          fill={m.color}
                          yAxisId={m.yAxisId ?? "count"}
                          opacity={0.6}
                          radius={[2, 2, 0, 0]}
                        />
                      );
                    }
                    return (
                      <Line
                        key={m.key}
                        type="monotone"
                        dataKey={m.key}
                        name={m.label}
                        stroke={m.color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        connectNulls={false}
                        yAxisId={m.yAxisId ?? "pct"}
                      />
                    );
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Annotations list */}
      {!hideAnnotations && annotations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Significant Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {annotations.map((ann, i) => (
              <AnnotationBadge key={i} ann={ann} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
