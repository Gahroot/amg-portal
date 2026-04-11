"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartTooltip } from "./chart-tooltip";

interface ChartDatum {
  name: string;
  count: number;
  fill: string;
}

interface DistributionChartCardProps {
  title: string;
  data: ChartDatum[];
  isLoading: boolean;
}

function DistributionChartCard({ title, data, isLoading }: DistributionChartCardProps) {
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
              <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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

interface DistributionChartsProps {
  isLoading: boolean;
  levelChartData: ChartDatum[];
  statusChartData: ChartDatum[];
}

export function DistributionCharts({
  isLoading,
  levelChartData,
  statusChartData,
}: DistributionChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <DistributionChartCard
        title="Escalations by Level"
        data={levelChartData}
        isLoading={isLoading}
      />
      <DistributionChartCard
        title="Escalations by Status"
        data={statusChartData}
        isLoading={isLoading}
      />
    </div>
  );
}
