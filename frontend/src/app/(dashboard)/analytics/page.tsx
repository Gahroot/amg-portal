"use client";

import Link from "next/link";
import { Balancer } from "react-wrap-balancer";
import { useAuth } from "@/providers/auth-provider";
import { useProgramHealth, usePortfolioSummary } from "@/hooks/use-dashboard";
import { ProgramHealthTable } from "@/components/dashboard/program-health-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
          className={`text-3xl font-bold ${variant === "destructive" ? "text-red-600 dark:text-red-400" : ""}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { data: summary, isLoading: summaryLoading } = usePortfolioSummary();
  const { data: health, isLoading: healthLoading } = useProgramHealth();

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
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            <Balancer>Analytics Dashboard</Balancer>
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
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      R: {summary.rag_breakdown.red ?? 0}
                    </span>
                    <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      A: {summary.rag_breakdown.amber ?? 0}
                    </span>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      G: {summary.rag_breakdown.green ?? 0}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}

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
