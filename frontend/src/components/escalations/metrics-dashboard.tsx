"use client";

import { useState } from "react";
import { AssigneesCard } from "@/components/escalations/metrics-dashboard/assignees-card";
import { type DatePreset } from "@/components/escalations/metrics-dashboard/constants";
import { DashboardHeader } from "@/components/escalations/metrics-dashboard/dashboard-header";
import { DistributionCharts } from "@/components/escalations/metrics-dashboard/distribution-charts";
import { exportMetricsCsv } from "@/components/escalations/metrics-dashboard/export-csv";
import { InsightsCard } from "@/components/escalations/metrics-dashboard/insights-card";
import { RecurringCard } from "@/components/escalations/metrics-dashboard/recurring-card";
import { SummaryCards } from "@/components/escalations/metrics-dashboard/summary-cards";
import { TrendChart } from "@/components/escalations/metrics-dashboard/trend-chart";
import { useEscalationMetrics } from "@/components/escalations/metrics-dashboard/use-escalation-metrics";

export function EscalationMetricsDashboard() {
  const [preset, setPreset] = useState<DatePreset>("90d");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    params,
    levelChartData,
    statusChartData,
    trendData,
  } = useEscalationMetrics({ preset, levelFilter, statusFilter });

  return (
    <div className="space-y-6">
      <DashboardHeader
        preset={preset}
        onPresetChange={setPreset}
        levelFilter={levelFilter}
        onLevelFilterChange={setLevelFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onRefresh={() => {
          void refetch();
        }}
        isFetching={isFetching}
        canExport={Boolean(data)}
        onExport={() => {
          if (data) exportMetricsCsv(data, params);
        }}
      />

      {isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load metrics. Please try refreshing.
        </div>
      )}

      <SummaryCards isLoading={isLoading} summary={data?.summary} />

      <DistributionCharts
        isLoading={isLoading}
        levelChartData={levelChartData}
        statusChartData={statusChartData}
      />

      <TrendChart isLoading={isLoading} data={trendData} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AssigneesCard isLoading={isLoading} assignees={data?.by_assignee} />
        <RecurringCard isLoading={isLoading} patterns={data?.recurring_patterns} />
      </div>

      <InsightsCard insights={data?.insights} />
    </div>
  );
}
