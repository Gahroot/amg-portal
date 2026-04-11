"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { getEscalationMetrics } from "@/lib/api/escalations";
import type {
  EscalationByLevel,
  EscalationMetricsParams,
  EscalationTrendPoint,
} from "@/types/escalation";
import {
  LEVEL_COLORS,
  LEVEL_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type DatePreset,
} from "./constants";

export function presetToDates(preset: DatePreset): { from: Date; to: Date } {
  const to = new Date();
  const days =
    preset === "30d" ? 30 : preset === "90d" ? 90 : preset === "180d" ? 180 : 365;
  return { from: subDays(to, days), to };
}

interface UseEscalationMetricsArgs {
  preset: DatePreset;
  levelFilter: string;
  statusFilter: string;
}

export function useEscalationMetrics({
  preset,
  levelFilter,
  statusFilter,
}: UseEscalationMetricsArgs) {
  const { from, to } = presetToDates(preset);
  const params: EscalationMetricsParams = {
    date_from: from.toISOString(),
    date_to: to.toISOString(),
    level: levelFilter !== "all" ? levelFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  };

  const query = useQuery({
    queryKey: ["escalation-metrics", params],
    queryFn: () => getEscalationMetrics(params),
    staleTime: 2 * 60 * 1000,
  });

  const { data } = query;

  const levelChartData = useMemo(
    () =>
      data?.by_level.map((b: EscalationByLevel) => ({
        name: LEVEL_LABELS[b.level] ?? b.level,
        count: b.count,
        fill: LEVEL_COLORS[b.level] ?? "#94a3b8",
      })) ?? [],
    [data],
  );

  const statusChartData = useMemo(
    () =>
      data?.by_status.map((b) => ({
        name: STATUS_LABELS[b.status] ?? b.status,
        count: b.count,
        fill: STATUS_COLORS[b.status] ?? "#94a3b8",
      })) ?? [],
    [data],
  );

  const trendData = useMemo(
    () =>
      data?.trend.map((t: EscalationTrendPoint) => ({
        ...t,
        label: t.week,
      })) ?? [],
    [data],
  );

  return {
    ...query,
    params,
    levelChartData,
    statusChartData,
    trendData,
  };
}
