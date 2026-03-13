"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { useProgramHealth, usePortfolioSummary } from "@/hooks/use-dashboard";
import { useAllKPIs } from "@/hooks/use-analytics";
import { ProgramHealthTable } from "@/components/dashboard/program-health-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { KPIMetric } from "@/lib/api/analytics";

const ALLOWED_ROLES = [
  "coordinator",
  "relationship_manager",
  "managing_director",
  "finance_compliance",
];

function SummaryCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: "default" | "destructive";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={`text-3xl font-bold ${variant === "destructive" ? "text-red-600" : ""}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

const STATUS_COLORS: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-red-500",
};

const STATUS_BG: Record<string, string> = {
  green: "border-emerald-200 bg-emerald-50",
  yellow: "border-amber-200 bg-amber-50",
  red: "border-red-200 bg-red-50",
};

function formatValue(metric: KPIMetric): string {
  if (metric.value === null) return "N/A";
  switch (metric.unit) {
    case "percent":
      return `${metric.value}%`;
    case "hours":
      return `${metric.value}h`;
    case "score":
      return `${metric.value}`;
    case "count":
      return `${metric.value}`;
    case "rate":
      return `${metric.value}%`;
    default:
      return `${metric.value}`;
  }
}

function formatTarget(metric: KPIMetric): string {
  const prefix =
    metric.unit === "hours" || metric.unit === "count" ? "≤" : "≥";
  switch (metric.unit) {
    case "percent":
    case "rate":
      return `${prefix} ${metric.target}%`;
    case "hours":
      return `${prefix} ${metric.target}h`;
    case "score":
      return `${prefix} ${metric.target}`;
    case "count":
      return `${prefix} ${metric.target}`;
    default:
      return `${prefix} ${metric.target}`;
  }
}

function KPICard({ metric }: { metric: KPIMetric }) {
  return (
    <div
      className={`rounded-lg border p-4 ${STATUS_BG[metric.status] ?? "border-gray-200 bg-white"}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-600">{metric.label}</p>
        <span
          className={`inline-block h-3 w-3 rounded-full ${STATUS_COLORS[metric.status] ?? "bg-gray-300"}`}
          title={metric.status}
        />
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">
        {formatValue(metric)}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Target: {formatTarget(metric)}
      </p>
    </div>
  );
}

function KPIDimensionSection({
  title,
  metrics,
}: {
  title: string;
  metrics: KPIMetric[];
}) {
  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold text-gray-800">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <KPICard key={m.label} metric={m} />
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { data: summary, isLoading: summaryLoading } = usePortfolioSummary();
  const { data: health, isLoading: healthLoading } = useProgramHealth();
  const { data: kpis, isLoading: kpisLoading } = useAllKPIs();

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
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Analytics Dashboard
          </h1>
          <Link href="/analytics/partner-performance">
            <Button variant="outline">Partner Performance</Button>
          </Link>
        </div>

        {/* Portfolio Summary Cards */}
        {summaryLoading ? (
          <p className="text-sm text-muted-foreground">
            Loading portfolio summary...
          </p>
        ) : summary ? (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <SummaryCard label="Total Programs" value={summary.total_programs} />
              <SummaryCard label="Active Programs" value={summary.active_programs} />
              <SummaryCard
                label="Completed Programs"
                value={summary.completed_programs}
              />
              <SummaryCard label="Total Clients" value={summary.total_clients} />
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <SummaryCard
                label="Open Escalations"
                value={summary.total_open_escalations}
                variant={summary.total_open_escalations > 0 ? "destructive" : "default"}
              />
              <SummaryCard
                label="SLA Breaches"
                value={summary.total_sla_breaches}
                variant={summary.total_sla_breaches > 0 ? "destructive" : "default"}
              />
              <SummaryCard
                label="Pending Decisions"
                value={summary.total_pending_decisions}
              />
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    RAG Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-red-600">
                      R: {summary.rag_breakdown.red ?? 0}
                    </span>
                    <span className="text-sm font-medium text-amber-600">
                      A: {summary.rag_breakdown.amber ?? 0}
                    </span>
                    <span className="text-sm font-medium text-green-600">
                      G: {summary.rag_breakdown.green ?? 0}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}

        {/* KPI Tracking Section */}
        <div>
          <h2 className="mb-4 font-serif text-xl font-semibold">
            Success Metrics &amp; KPIs
          </h2>

          {kpisLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading KPI data...
            </p>
          ) : kpis ? (
            <div className="space-y-8">
              <KPIDimensionSection
                title="Client Experience"
                metrics={[
                  kpis.client_experience.nps_score,
                  kpis.client_experience.report_on_time_rate,
                  kpis.client_experience.decision_response_time_hours,
                ]}
              />
              <KPIDimensionSection
                title="Operational Performance"
                metrics={[
                  kpis.operations.milestone_on_time_rate,
                  kpis.operations.escalation_resolution_hours,
                  kpis.operations.deliverable_first_pass_rate,
                  kpis.operations.closure_completeness_rate,
                ]}
              />
              <KPIDimensionSection
                title="Partner Network"
                metrics={[
                  kpis.partner_network.avg_partner_score,
                  kpis.partner_network.sla_breach_rate,
                  kpis.partner_network.task_completion_rate,
                  kpis.partner_network.brief_to_acceptance_hours,
                ]}
              />
              <KPIDimensionSection
                title="Security &amp; Compliance"
                metrics={[
                  kpis.compliance.kyc_currency_rate,
                  kpis.compliance.unauthorized_access_incidents,
                  kpis.compliance.audit_log_completeness,
                  kpis.compliance.access_review_completion_rate,
                ]}
              />
            </div>
          ) : null}
        </div>

        {/* Program Health Table */}
        <div>
          <h2 className="mb-4 font-serif text-xl font-semibold">
            Program Health
          </h2>
          {healthLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading program health data...
            </p>
          ) : health ? (
            <ProgramHealthTable programs={health.programs} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
