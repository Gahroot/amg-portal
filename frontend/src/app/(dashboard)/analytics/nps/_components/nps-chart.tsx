import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { NPSTrendAnalysis } from "@/types/nps-survey";
import { getNPSColor } from "./nps-utils";

type TrendDirection = "up" | "down" | "stable";

function getTrendIcon(direction: TrendDirection): string {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  return "→";
}

function getTrendColor(direction: TrendDirection): string {
  if (direction === "up") return "text-green-600 dark:text-green-400";
  if (direction === "down") return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

interface NPSChartProps {
  trends: NPSTrendAnalysis;
  totalSurveys: number;
  activeSurveys: number;
}

export function NPSChart({ trends, totalSurveys, activeSurveys }: NPSChartProps) {
  const trendDirection = trends.trend_direction as TrendDirection;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current NPS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-3xl font-bold ${getNPSColor(trends.current_nps)}`}
            >
              {trends.current_nps}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Target: 70+
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-3xl font-bold ${getTrendColor(trendDirection)}`}
            >
              {getTrendIcon(trendDirection)}{" "}
              {trends.change !== null
                ? `${trends.change > 0 ? "+" : ""}${trends.change}`
                : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              vs previous period
              {trends.previous_nps !== null
                ? ` (${trends.previous_nps})`
                : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Surveys
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalSurveys}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeSurveys} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Data Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {trends.trends.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              quarters tracked
            </p>
          </CardContent>
        </Card>
      </div>

      {trends.trends.length > 0 && (
        <div>
          <h2 className="mb-3 font-serif text-xl font-semibold">
            NPS Trend History
          </h2>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">NPS Score</TableHead>
                  <TableHead className="text-right">Responses</TableHead>
                  <TableHead className="text-right">Promoters %</TableHead>
                  <TableHead className="text-right">Passives %</TableHead>
                  <TableHead className="text-right">Detractors %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trends.trends.map((t) => (
                  <TableRow key={t.period}>
                    <TableCell className="font-medium">
                      {t.period}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-bold ${getNPSColor(t.nps_score)}`}
                      >
                        {t.nps_score}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {t.response_count}
                    </TableCell>
                    <TableCell className="text-right text-green-600 dark:text-green-400">
                      {t.promoters_percent.toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-right text-amber-600 dark:text-amber-400">
                      {t.passives_percent.toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-right text-red-600 dark:text-red-400">
                      {t.detractors_percent.toFixed(0)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
