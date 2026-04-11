"use client";

import { format, parseISO } from "date-fns";
import { TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartTooltip } from "./chart-tooltip";
import { LEVEL_COLORS } from "./constants";

interface TrendDatum {
  label: string;
  total: number;
  task: number;
  milestone: number;
  program: number;
  client_impact: number;
}

interface TrendChartProps {
  isLoading: boolean;
  data: TrendDatum[];
}

export function TrendChart({ isLoading, data }: TrendChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Weekly Escalation Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : data.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
            No trend data for this period.
          </div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid
                  strokeDasharray="1 4"
                  strokeOpacity={0.4}
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
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
  );
}
