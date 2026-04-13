"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ── Shared constants ──────────────────────────────────────────────────────────

export const LEVEL_COLORS: Record<string, string> = {
  task: "#8b7d5e",
  milestone: "#c4a060",
  program: "var(--color-charcoal)",
  client_impact: "#8B2020",
};

export const STATUS_COLORS: Record<string, string> = {
  open: "#8B2020",
  acknowledged: "#c4a060",
  investigating: "var(--color-charcoal)",
  resolved: "#4A7A5A",
  closed: "#B8B0A0",
};

// ── Shared chart tooltip (also used by escalation-trend-chart) ───────────────

export interface ChartTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  labelFormatter?: (v: string) => string;
}

export function ChartTooltip({ active, payload, label, labelFormatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const displayLabel = label ? (labelFormatter ? labelFormatter(label) : label) : "";
  return (
    <div className="rounded-lg border border-t-2 border-t-primary bg-background shadow-md p-3 text-xs space-y-1 min-w-[160px]">
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

// ── Chart data types ──────────────────────────────────────────────────────────

export interface LevelChartEntry {
  name: string;
  count: number;
  fill: string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface EscalationLevelChartProps {
  data: LevelChartEntry[];
  isLoading: boolean;
  title: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EscalationLevelChart({ data, isLoading, title }: EscalationLevelChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : data.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            No data
          </div>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="1 4"
                  strokeOpacity={0.4}
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
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
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
