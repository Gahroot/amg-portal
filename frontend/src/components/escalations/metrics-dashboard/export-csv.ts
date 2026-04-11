import type {
  EscalationDetailedMetrics,
  EscalationMetricsParams,
} from "@/types/escalation";
import { LEVEL_LABELS, STATUS_LABELS } from "./constants";

export function exportMetricsCsv(
  metrics: EscalationDetailedMetrics,
  params: EscalationMetricsParams,
) {
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

  rows.push([
    "## Weekly Trend",
    "Task",
    "Milestone",
    "Program",
    "Client Impact",
    "Total",
  ]);
  for (const r of metrics.trend) {
    rows.push([
      r.week,
      String(r.task),
      String(r.milestone),
      String(r.program),
      String(r.client_impact),
      String(r.total),
    ]);
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
