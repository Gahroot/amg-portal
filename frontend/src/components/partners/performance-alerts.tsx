"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Minus,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MetricAlert {
  metric: string;
  label: string;
  current_value: number | null;
  threshold: number;
  status: "good" | "warning" | "critical";
  trend: "improving" | "declining" | "stable" | "insufficient_data";
  suggestion: string;
}

interface PerformanceStatusResponse {
  partner_id: string;
  firm_name: string;
  overall_status: "good" | "warning" | "critical";
  metrics: Record<string, number | null>;
  thresholds: Record<string, number>;
  alerts: MetricAlert[];
}

// ── API ───────────────────────────────────────────────────────────────────────

async function getMyPerformanceStatus(): Promise<PerformanceStatusResponse> {
  const response = await api.get<PerformanceStatusResponse>(
    "/api/v1/partner-portal/performance-status"
  );
  return response.data;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: "good" | "warning" | "critical" }) {
  if (status === "good")
    return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
  if (status === "warning")
    return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
}

function TrendIcon({
  trend,
}: {
  trend: "improving" | "declining" | "stable" | "insufficient_data";
}) {
  if (trend === "improving")
    return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />;
  if (trend === "declining")
    return <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />;
  if (trend === "stable") return <Minus className="h-4 w-4 text-muted-foreground" />;
  return <Info className="h-4 w-4 text-muted-foreground" />;
}

function trendLabel(trend: string): string {
  const labels: Record<string, string> = {
    improving: "Improving",
    declining: "Declining",
    stable: "Stable",
    insufficient_data: "Insufficient data",
  };
  return labels[trend] ?? trend;
}

function statusBadgeVariant(
  status: "good" | "warning" | "critical"
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "critical") return "destructive";
  if (status === "warning") return "secondary";
  return "outline";
}

function formatValue(metric: string, value: number | null): string {
  if (value === null) return "N/A";
  if (metric === "sla_compliance_pct") return `${value.toFixed(1)}%`;
  return `${value.toFixed(1)} / 5`;
}

function formatThreshold(metric: string, threshold: number): string {
  if (metric === "sla_compliance_pct") return `${threshold.toFixed(0)}%`;
  return `${threshold.toFixed(1)} / 5`;
}

// ── Alert Row ─────────────────────────────────────────────────────────────────

function AlertRow({ alert }: { alert: MetricAlert }) {
  const [expanded, setExpanded] = useState(false);

  const valueColor =
    alert.status === "critical"
      ? "text-red-600 dark:text-red-400 font-semibold"
      : alert.status === "warning"
      ? "text-amber-600 dark:text-amber-400 font-semibold"
      : "text-green-700 dark:text-green-300 font-medium";

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        {/* Metric name + status icon */}
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon status={alert.status} />
          <span className="text-sm font-medium">{alert.label}</span>
        </div>

        {/* Current value & threshold */}
        <div className="flex items-center gap-3 text-sm shrink-0">
          <span className={valueColor}>
            {formatValue(alert.metric, alert.current_value)}
          </span>
          <span className="text-muted-foreground text-xs">
            / {formatThreshold(alert.metric, alert.threshold)} min
          </span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendIcon trend={alert.trend} />
            <span>{trendLabel(alert.trend)}</span>
          </div>
          <Badge variant={statusBadgeVariant(alert.status)} className="text-xs">
            {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Hide suggestion" : "Show suggestion"}
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Suggestion */}
      {expanded && (
        <div className="mt-3 rounded-md bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed border-l-2 border-amber-400 dark:border-amber-600">
          <strong className="text-foreground">Suggestion: </strong>
          {alert.suggestion}
        </div>
      )}
    </div>
  );
}

// ── Overall Status Banner ─────────────────────────────────────────────────────

function OverallStatusBanner({
  status,
}: {
  status: "good" | "warning" | "critical";
}) {
  if (status === "good") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-900 dark:text-green-300">
            Performance is on track
          </p>
          <p className="text-xs text-green-700 dark:text-green-300">
            All metrics are within acceptable thresholds.
          </p>
        </div>
      </div>
    );
  }

  if (status === "warning") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
            Attention required
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            One or more metrics need improvement. Review the alerts below.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3">
      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-red-900 dark:text-red-300">
          Critical performance issues
        </p>
        <p className="text-xs text-red-700 dark:text-red-300">
          Metrics are below the minimum threshold. Immediate action is required.
        </p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PerformanceAlerts() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["partner-portal", "performance-status"],
    queryFn: getMyPerformanceStatus,
    // Refresh every 30 minutes — thresholds don't change frequently
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return null; // silent fail — not critical for dashboard
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Performance Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <OverallStatusBanner status={data.overall_status} />

        {data.alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            No active performance alerts.
          </p>
        ) : (
          <div className="space-y-2">
            {data.alerts.map((alert) => (
              <AlertRow key={alert.metric} alert={alert} />
            ))}
          </div>
        )}

        {/* Metric summary row */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            {
              key: "sla_compliance_pct",
              label: "SLA",
              threshold: data.thresholds.sla_compliance_threshold,
            },
            {
              key: "avg_quality",
              label: "Quality",
              threshold: data.thresholds.quality_score_threshold,
            },
            {
              key: "avg_overall",
              label: "Overall",
              threshold: data.thresholds.overall_score_threshold,
            },
          ].map(({ key, label, threshold }) => {
            const value = data.metrics[key];
            const pct = key === "sla_compliance_pct";
            const numericValue = value !== null && value !== undefined ? value : null;
            const met = numericValue !== null && numericValue >= threshold;
            return (
              <div
                key={key}
                className={`rounded-md border px-3 py-2 text-center ${
                  met
                    ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30"
                    : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
                }`}
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p
                  className={`text-base font-semibold ${
                    met ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
                  }`}
                >
                  {numericValue !== null
                    ? pct
                      ? `${numericValue.toFixed(1)}%`
                      : numericValue.toFixed(1)
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  min {pct ? `${threshold.toFixed(0)}%` : threshold.toFixed(1)}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
