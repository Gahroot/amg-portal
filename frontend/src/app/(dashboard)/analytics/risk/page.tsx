"use client";

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  useProgramRiskScores,
  usePredictiveRiskAlerts,
} from "@/hooks/use-risk-forecast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  PredictiveRiskAlert,
  RiskScoreResponse,
  RiskStatus,
} from "@/types/risk-forecast";

const ALLOWED_ROLES = [
  "coordinator",
  "relationship_manager",
  "managing_director",
  "finance_compliance",
];

function riskBadgeVariant(
  status: RiskStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "healthy":
      return "default";
    case "at_risk":
      return "secondary";
    case "critical":
      return "destructive";
    default:
      return "outline";
  }
}

function riskLabel(status: RiskStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "at_risk":
      return "At Risk";
    case "critical":
      return "Critical";
    default:
      return status;
  }
}

function trendIndicator(trend: string): string {
  switch (trend) {
    case "improving":
      return "↑ Improving";
    case "declining":
      return "↓ Declining";
    case "stable":
    default:
      return "→ Stable";
  }
}

function trendColor(trend: string): string {
  switch (trend) {
    case "improving":
      return "text-green-600";
    case "declining":
      return "text-red-600";
    default:
      return "text-muted-foreground";
  }
}

function riskScoreColor(score: number): string {
  if (score <= 30) return "bg-green-500";
  if (score <= 60) return "bg-amber-500";
  return "bg-red-500";
}

function SummaryCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: "default" | "destructive" | "warning" | "success";
}) {
  const colorClass =
    variant === "destructive"
      ? "text-red-600"
      : variant === "warning"
        ? "text-amber-600"
        : variant === "success"
          ? "text-green-600"
          : "";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function PredictiveAlertRow({ alert }: { alert: PredictiveRiskAlert }) {
  const worstLevel = alert.milestone_predictions.some(
    (p) => p.risk_level === "critical",
  )
    ? "critical"
    : "warning";

  return (
    <TableRow>
      <TableCell className="font-medium">{alert.program_title}</TableCell>
      <TableCell>{alert.client_name}</TableCell>
      <TableCell>
        <Badge variant={worstLevel === "critical" ? "destructive" : "secondary"}>
          {worstLevel === "critical" ? "⚠ Critical" : "⏳ Warning"}
        </Badge>
      </TableCell>
      <TableCell className="tabular-nums">
        {alert.earliest_breach_days != null
          ? `${alert.earliest_breach_days}d`
          : "—"}
      </TableCell>
      <TableCell className="tabular-nums">
        {alert.task_velocity}/wk
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          {alert.milestone_predictions.map((p) => (
            <div
              key={p.milestone_id}
              className="flex items-center gap-1 text-xs"
            >
              <Badge
                variant={
                  p.risk_level === "critical" ? "destructive" : "outline"
                }
                className="text-[10px] px-1 py-0"
              >
                {p.days_until_breach}d
              </Badge>
              <span className="truncate max-w-[180px]">
                {p.milestone_title}
              </span>
              <span className="text-muted-foreground">
                ({p.completion_pct}% → {p.predicted_completion_pct_at_due}%)
              </span>
            </div>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

function ProgramRiskRow({ program }: { program: RiskScoreResponse }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{program.program_title}</TableCell>
      <TableCell>{program.client_name}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="w-16">
            <Progress
              value={program.risk_score}
              className={`h-2 [&>[data-slot=progress-indicator]]:${riskScoreColor(program.risk_score)}`}
            />
          </div>
          <span className="text-sm font-medium tabular-nums">
            {program.risk_score}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={riskBadgeVariant(program.risk_status)}>
          {riskLabel(program.risk_status)}
        </Badge>
      </TableCell>
      <TableCell>
        <span className={`text-sm ${trendColor(program.trend)}`}>
          {trendIndicator(program.trend)}
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {program.program_status}
      </TableCell>
    </TableRow>
  );
}

export default function RiskDashboardPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const params =
    statusFilter === "all"
      ? undefined
      : { risk_status: statusFilter as RiskStatus };

  const { data, isLoading } = useProgramRiskScores(params);
  const { data: predictive, isLoading: predictiveLoading } =
    usePredictiveRiskAlerts();

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Risk Alerts &amp; Health Forecasting
        </h1>

        {/* Summary Cards */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">
            Calculating risk scores...
          </p>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <SummaryCard label="Total Programs" value={data.total} />
              <SummaryCard
                label="Healthy"
                value={data.healthy_count}
                variant="success"
              />
              <SummaryCard
                label="At Risk"
                value={data.at_risk_count}
                variant="warning"
              />
              <SummaryCard
                label="Critical"
                value={data.critical_count}
                variant="destructive"
              />
            </div>

            {/* Filter Tabs + Table */}
            <Tabs
              value={statusFilter}
              onValueChange={setStatusFilter}
              className="space-y-4"
            >
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="healthy">Healthy</TabsTrigger>
                <TabsTrigger value="at_risk">At Risk</TabsTrigger>
                <TabsTrigger value="critical">Critical</TabsTrigger>
              </TabsList>

              <TabsContent value={statusFilter} className="mt-0">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Program</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Risk Score</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Trend</TableHead>
                          <TableHead>Program Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.programs.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center text-muted-foreground"
                            >
                              No programs found for this filter.
                            </TableCell>
                          </TableRow>
                        ) : (
                          data.programs.map((program) => (
                            <ProgramRiskRow
                              key={program.program_id}
                              program={program}
                            />
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : null}

        {/* Predictive Risk Alerts */}
        <div className="space-y-4">
          <h2 className="font-serif text-xl font-semibold tracking-tight">
            Predictive Milestone Breach Alerts
          </h2>
          {predictiveLoading ? (
            <p className="text-sm text-muted-foreground">
              Analysing milestone trajectories...
            </p>
          ) : predictive && predictive.total > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <SummaryCard
                  label="Programs at Risk"
                  value={predictive.total}
                  variant="warning"
                />
                <SummaryCard
                  label="Warning (≤7d)"
                  value={predictive.warning_count}
                  variant="warning"
                />
                <SummaryCard
                  label="Critical (≤3d)"
                  value={predictive.critical_count}
                  variant="destructive"
                />
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Program</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Breach In</TableHead>
                        <TableHead>Velocity</TableHead>
                        <TableHead>Milestones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {predictive.alerts.map((alert) => (
                        <PredictiveAlertRow
                          key={alert.program_id}
                          alert={alert}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No predicted milestone breaches in the next 7 days.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
