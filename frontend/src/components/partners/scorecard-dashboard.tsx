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
} from "recharts";
import { format, parseISO } from "date-fns";
import {
  ShieldCheck,
  Clock,
  Star,
  PackageCheck,
  ThumbsUp,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyScorecard } from "@/hooks/use-partner-portal";
import type { ScorecardPeriod, PartnerScorecard, ScorecardDataPoint } from "@/lib/api/partner-portal";

// ─── Period Selector ──────────────────────────────────────────────────────────

const PERIODS: { value: ScorecardPeriod; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 80) return "text-green-700 dark:text-green-300";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBg(score: number | null): string {
  if (score === null) return "bg-muted";
  if (score >= 80) return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800";
  if (score >= 60) return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
  return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
}

function progressColor(score: number | null): string {
  if (score === null) return "";
  if (score >= 80) return "[&>div]:bg-green-600";
  if (score >= 60) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-red-500";
}

function trendIndicator(current: number | null, avg: number | null) {
  if (current === null || avg === null) return null;
  const diff = current - avg;
  if (diff > 2) return { icon: TrendingUp, label: `+${diff.toFixed(1)} vs avg`, color: "text-green-600 dark:text-green-400" };
  if (diff < -2) return { icon: TrendingDown, label: `${diff.toFixed(1)} vs avg`, color: "text-red-600 dark:text-red-400" };
  return { icon: Minus, label: "On par with avg", color: "text-muted-foreground" };
}

function fmt(val: number | null, suffix = ""): string {
  if (val === null) return "N/A";
  return `${val.toFixed(1)}${suffix}`;
}

function fmtHours(hours: number | null): string {
  if (hours === null) return "N/A";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

// ─── Composite Score Ring ─────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number | null }) {
  const value = score ?? 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (value / 100) * circumference;
  const color = value >= 80 ? "#4A7A5A" : value >= 60 ? "#c4a060" : "#8B2020";

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
        <circle
          cx="72"
          cy="72"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="text-muted/30"
        />
        <circle
          cx="72"
          cy="72"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold tabular-nums ${scoreColor(score)}`}>
          {score !== null ? score.toFixed(0) : "—"}
        </span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  score: number | null;       // 0–100 for the progress bar
  avgScore: number | null;
  iconColor?: string;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  score,
  avgScore,
  iconColor = "text-primary",
}: MetricCardProps) {
  const trend = trendIndicator(score, avgScore);
  const TrendIcon = trend?.icon ?? Minus;

  return (
    <Card className={`border ${scoreBg(score)}`}>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 flex-shrink-0 ${iconColor}`} />
            <span className="text-sm font-medium text-foreground">{title}</span>
          </div>
          {trend && (
            <span className={`flex items-center gap-1 text-xs ${trend.color}`}>
              <TrendIcon className="h-3 w-3" />
              {trend.label}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-bold tabular-nums ${scoreColor(score)}`}>{value}</span>
        </div>
        {score !== null && (
          <Progress
            value={Math.min(100, score)}
            className={`h-1.5 ${progressColor(score)}`}
          />
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
        {avgScore !== null && (
          <p className="text-xs text-muted-foreground">
            Platform avg: {fmt(avgScore, score !== null && score > 10 ? "%" : "")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Trend Chart ─────────────────────────────────────────────────────────────

function TrendChart({ data }: { data: ScorecardDataPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        No trend data available for this period.
      </div>
    );
  }

  const chartData = data.map((dp) => ({
    ...dp,
    week: format(parseISO(dp.week_start), "MMM d"),
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="1 4" strokeOpacity={0.4} stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="pct"
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <YAxis
          yAxisId="score"
          orientation="right"
          domain={[1, 5]}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderTop: "2px solid hsl(var(--primary))",
            borderRadius: "8px",
            fontSize: 12,
          }}
          formatter={(val, name) => {
            if (val === null || val === undefined) return ["—", name ?? ""];
            const n = val as number;
            if (name === "SLA Compliance") return [`${n.toFixed(1)}%`, name];
            if (name === "Assignments") return [n, name];
            return [n.toFixed(2), name ?? ""];
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="sla_compliance_pct"
          name="SLA Compliance"
          stroke="var(--color-primary)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          yAxisId="score"
          type="monotone"
          dataKey="avg_quality"
          name="Quality Score"
          stroke="var(--color-accent)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          yAxisId="score"
          type="monotone"
          dataKey="avg_overall"
          name="Overall Rating"
          stroke="var(--color-charcoal)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Bar
          yAxisId="pct"
          dataKey="assignments_completed"
          name="Assignments"
          fill="var(--color-muted)"
          opacity={0.35}
          radius={[2, 2, 0, 0]}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── Rating Breakdown ─────────────────────────────────────────────────────────

function RatingBreakdown({ scorecard }: { scorecard: PartnerScorecard }) {
  const { avg_quality, avg_timeliness, avg_communication, avg_overall } =
    scorecard.rating_breakdown;

  const dims = [
    { label: "Quality", value: avg_quality },
    { label: "Timeliness", value: avg_timeliness },
    { label: "Communication", value: avg_communication },
    { label: "Overall", value: avg_overall },
  ];

  return (
    <div className="space-y-3">
      {dims.map(({ label, value }) => (
        <div key={label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium tabular-nums">
              {value !== null ? `${value.toFixed(2)} / 5.0` : "N/A"}
            </span>
          </div>
          <Progress
            value={value !== null ? value * 20 : 0}
            className={`h-1.5 ${progressColor(value !== null ? value * 20 : null)}`}
          />
        </div>
      ))}
      <p className="text-xs text-muted-foreground pt-1">
        Based on {scorecard.totals.total_ratings} rating
        {scorecard.totals.total_ratings !== 1 ? "s" : ""} in this period.
      </p>
    </div>
  );
}

// ─── Scorecard Loading Skeleton ───────────────────────────────────────────────

function ScorecardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-36 w-36 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-60 rounded-lg" />
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function ScorecardDashboard() {
  const [period, setPeriod] = React.useState<ScorecardPeriod>("90d");
  const { data, isLoading, isError } = useMyScorecard(period);

  return (
    <div className="space-y-6">
      {/* Header + period selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold tracking-tight">
            Performance Scorecard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your performance metrics and trends over the selected period.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/50 w-fit">
          {PERIODS.map(({ value, label }) => (
            <Button
              key={value}
              size="sm"
              variant={period === value ? "default" : "ghost"}
              className="h-7 text-xs px-3"
              onClick={() => setPeriod(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && <ScorecardSkeleton />}
      {isError && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              Failed to load scorecard data. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Composite score + summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                {/* Ring */}
                <div className="flex flex-col items-center gap-2">
                  <ScoreRing score={data.metrics.composite_score} />
                  <Badge
                    variant={
                      data.metrics.composite_score === null
                        ? "outline"
                        : data.metrics.composite_score >= 80
                          ? "default"
                          : data.metrics.composite_score >= 60
                            ? "secondary"
                            : "destructive"
                    }
                    className="text-xs"
                  >
                    {data.metrics.composite_score === null
                      ? "No data"
                      : data.metrics.composite_score >= 80
                        ? "Excellent"
                        : data.metrics.composite_score >= 60
                          ? "Good"
                          : "Needs attention"}
                  </Badge>
                </div>

                {/* Summary stats */}
                <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Assignments</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {data.totals.total_assignments}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Completed</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {data.totals.completed_assignments}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">SLA Checks</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {data.totals.total_sla_checked}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">SLA Breaches</p>
                    <p
                      className={`text-lg font-semibold tabular-nums ${
                        data.totals.total_sla_breached > 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      {data.totals.total_sla_breached}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ratings</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {data.totals.total_ratings}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Composite Score</p>
                    <p className={`text-lg font-semibold tabular-nums ${scoreColor(data.metrics.composite_score)}`}>
                      {data.metrics.composite_score !== null
                        ? data.metrics.composite_score.toFixed(1)
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metric cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="SLA Compliance"
              value={fmt(data.metrics.sla_compliance_pct, "%")}
              subtitle={`${data.totals.total_sla_checked} checks · ${data.totals.total_sla_breached} breached`}
              icon={ShieldCheck}
              score={data.metrics.sla_compliance_pct}
              avgScore={data.averages.sla_compliance_pct}
              iconColor="text-indigo-600 dark:text-indigo-400"
            />
            <MetricCard
              title="Response Time"
              value={fmtHours(data.metrics.avg_response_time_hours)}
              subtitle="Avg time from dispatch to acceptance"
              icon={Clock}
              score={
                data.metrics.avg_response_time_hours !== null
                  ? Math.max(0, 100 - (data.metrics.avg_response_time_hours / 48) * 100)
                  : null
              }
              avgScore={null}
              iconColor="text-sky-600"
            />
            <MetricCard
              title="Quality Score"
              value={fmt(data.metrics.quality_score) + (data.metrics.quality_score !== null ? " / 5" : "")}
              subtitle={`${data.totals.total_ratings} ratings this period`}
              icon={Star}
              score={data.metrics.quality_score !== null ? data.metrics.quality_score * 20 : null}
              avgScore={data.averages.quality_score !== null ? data.averages.quality_score * 20 : null}
              iconColor="text-amber-500"
            />
            <MetricCard
              title="On-time Delivery"
              value={fmt(data.metrics.on_time_delivery_rate, "%")}
              subtitle="Completed assignments delivered on schedule"
              icon={PackageCheck}
              score={data.metrics.on_time_delivery_rate}
              avgScore={null}
              iconColor="text-emerald-600 dark:text-emerald-400"
            />
            <MetricCard
              title="Client Satisfaction"
              value={
                fmt(data.metrics.client_satisfaction) +
                (data.metrics.client_satisfaction !== null ? " / 5" : "")
              }
              subtitle="Overall rating from program reviews"
              icon={ThumbsUp}
              score={
                data.metrics.client_satisfaction !== null
                  ? data.metrics.client_satisfaction * 20
                  : null
              }
              avgScore={
                data.averages.client_satisfaction !== null
                  ? data.averages.client_satisfaction * 20
                  : null
              }
              iconColor="text-violet-600"
            />
          </div>

          {/* Trend chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Weekly Trend</CardTitle>
              <CardDescription className="text-xs">
                SLA compliance, quality, overall rating and assignment completions week by week.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart data={data.data_points} />
            </CardContent>
          </Card>

          {/* Rating breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Rating Breakdown</CardTitle>
              <CardDescription className="text-xs">
                Average scores across each rating dimension (1–5 scale).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RatingBreakdown scorecard={data} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
