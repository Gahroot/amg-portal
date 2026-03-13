"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FolderOpen,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  usePortfolioSummary,
  useProgramHealth,
  useAtRiskPrograms,
} from "@/hooks/use-dashboard";
import { ProgramHealthTable } from "@/components/dashboard/program-health-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const ROLE_LABELS: Record<string, string> = {
  managing_director: "Managing Director",
  relationship_manager: "Relationship Manager",
  coordinator: "Coordinator",
  finance_compliance: "Finance & Compliance",
};

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  href?: string;
  accent?: "default" | "destructive" | "warning";
}

function StatCard({ title, value, icon, href, accent = "default" }: StatCardProps) {
  const accentColors: Record<string, string> = {
    default: "text-primary",
    destructive: "text-red-600",
    warning: "text-amber-600",
  };

  const inner = (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 pt-0">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted ${accentColors[accent]}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }

  return inner;
}

// ---------------------------------------------------------------------------
// Stat card skeleton
// ---------------------------------------------------------------------------

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-0">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// RAG breakdown bar
// ---------------------------------------------------------------------------

function RagBreakdownBar({ breakdown }: { breakdown: Record<string, number> }) {
  const red = breakdown.red ?? 0;
  const amber = breakdown.amber ?? 0;
  const green = breakdown.green ?? 0;
  const total = red + amber + green;

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No programs to display RAG status.
      </p>
    );
  }

  const pct = (n: number) => ((n / total) * 100).toFixed(1);

  return (
    <div className="space-y-3">
      {/* Bar */}
      <div className="flex h-4 w-full overflow-hidden rounded-full">
        {red > 0 && (
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${pct(red)}%` }}
          />
        )}
        {amber > 0 && (
          <div
            className="bg-amber-400 transition-all"
            style={{ width: `${pct(amber)}%` }}
          />
        )}
        {green > 0 && (
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${pct(green)}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
          Red: {red}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-amber-400" />
          Amber: {amber}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
          Green: {green}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Role-specific hints
// ---------------------------------------------------------------------------

function RoleHints({ role }: { role: string }) {
  switch (role) {
    case "relationship_manager":
      return (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-0">
            <p className="text-sm text-blue-800">
              <strong>Your portfolio</strong> — Showing programs and clients
              assigned to you. Visit{" "}
              <Link href="/clients" className="underline">
                Clients
              </Link>{" "}
              to manage your relationships.
            </p>
          </CardContent>
        </Card>
      );
    case "coordinator":
      return (
        <Card className="border-violet-200 bg-violet-50/50">
          <CardContent className="pt-0">
            <p className="text-sm text-violet-800">
              <strong>Coordination view</strong> — Track active programs, partner
              deliverables, and tasks.{" "}
              <Link href="/tasks" className="underline">
                Task Board
              </Link>{" "}
              ·{" "}
              <Link href="/deliverables" className="underline">
                Deliverables
              </Link>
            </p>
          </CardContent>
        </Card>
      );
    case "finance_compliance":
      return (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="pt-0">
            <p className="text-sm text-emerald-800">
              <strong>Finance &amp; Compliance</strong> — Review pending
              approvals and audit status.{" "}
              <Link href="/approvals" className="underline">
                Approvals
              </Link>{" "}
              ·{" "}
              <Link href="/compliance" className="underline">
                Compliance
              </Link>
            </p>
          </CardContent>
        </Card>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Main dashboard page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { user } = useAuth();

  const {
    data: portfolio,
    isLoading: portfolioLoading,
  } = usePortfolioSummary();

  const {
    data: programHealth,
    isLoading: healthLoading,
  } = useProgramHealth();

  const {
    data: atRisk,
    isLoading: atRiskLoading,
  } = useAtRiskPrograms();

  const role = user?.role ?? "";

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {user?.full_name ?? "User"}
            {role && (
              <>
                {" · "}
                <Badge variant="secondary" className="ml-1 align-middle">
                  {ROLE_LABELS[role] ?? role}
                </Badge>
              </>
            )}
          </p>
        </div>

        {/* Role-specific hints */}
        <RoleHints role={role} />

        {/* ---------------------------------------------------------------- */}
        {/* Stat cards */}
        {/* ---------------------------------------------------------------- */}
        {portfolioLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        ) : portfolio ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              title="Total Programs"
              value={portfolio.total_programs}
              icon={<FolderOpen className="h-5 w-5" />}
              href="/programs"
            />
            <StatCard
              title="Active Programs"
              value={portfolio.active_programs}
              icon={<Activity className="h-5 w-5" />}
              href="/programs"
            />
            <StatCard
              title="Total Clients"
              value={portfolio.total_clients}
              icon={<Users className="h-5 w-5" />}
              href="/clients"
            />
            <StatCard
              title="Open Escalations"
              value={portfolio.total_open_escalations}
              icon={<AlertTriangle className="h-5 w-5" />}
              href="/escalations"
              accent={
                portfolio.total_open_escalations > 0
                  ? "destructive"
                  : "default"
              }
            />
            <StatCard
              title="SLA Breaches"
              value={portfolio.total_sla_breaches}
              icon={<ShieldAlert className="h-5 w-5" />}
              href="/sla"
              accent={
                portfolio.total_sla_breaches > 0 ? "destructive" : "default"
              }
            />
            <StatCard
              title="Pending Decisions"
              value={portfolio.total_pending_decisions}
              icon={<Clock className="h-5 w-5" />}
              href="/decisions"
              accent={
                portfolio.total_pending_decisions > 0 ? "warning" : "default"
              }
            />
          </div>
        ) : null}

        {/* ---------------------------------------------------------------- */}
        {/* RAG breakdown */}
        {/* ---------------------------------------------------------------- */}
        {portfolio && (
          <Section title="Program RAG Breakdown">
            <Card>
              <CardContent className="pt-0">
                <RagBreakdownBar breakdown={portfolio.rag_breakdown} />
              </CardContent>
            </Card>
          </Section>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* At-risk programs */}
        {/* ---------------------------------------------------------------- */}
        <Section
          title="At-Risk Programs"
          action={
            <Link
              href="/escalations"
              className="text-sm text-primary hover:underline"
            >
              View all escalations →
            </Link>
          }
        >
          {atRiskLoading ? (
            <Card>
              <CardContent className="space-y-3 pt-0">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ) : atRisk && atRisk.programs.length > 0 ? (
            <ProgramHealthTable programs={atRisk.programs} />
          ) : (
            <Card>
              <CardContent className="flex items-center gap-2 pt-0 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                No at-risk programs — all clear.
              </CardContent>
            </Card>
          )}
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* Full program health table */}
        {/* ---------------------------------------------------------------- */}
        <Section
          title="Program Health"
          action={
            <Link
              href="/programs"
              className="text-sm text-primary hover:underline"
            >
              All programs →
            </Link>
          }
        >
          {healthLoading ? (
            <Card>
              <CardContent className="space-y-3 pt-0">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ) : programHealth ? (
            <>
              <ProgramHealthTable programs={programHealth.programs} />
              <p className="text-sm text-muted-foreground">
                {programHealth.total} program
                {programHealth.total !== 1 ? "s" : ""} total
              </p>
            </>
          ) : null}
        </Section>

        {/* ---------------------------------------------------------------- */}
        {/* Quick links for SLA & Escalations */}
        {/* ---------------------------------------------------------------- */}
        {portfolio && (portfolio.total_open_escalations > 0 || portfolio.total_sla_breaches > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {portfolio.total_open_escalations > 0 && (
              <Link href="/escalations">
                <Card className="border-red-200 bg-red-50/50 transition-shadow hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-800">
                      <AlertTriangle className="h-5 w-5" />
                      {portfolio.total_open_escalations} Open Escalation
                      {portfolio.total_open_escalations !== 1 ? "s" : ""}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-red-700">
                      Escalations require immediate attention. Click to review and
                      take action.
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )}

            {portfolio.total_sla_breaches > 0 && (
              <Link href="/sla">
                <Card className="border-red-200 bg-red-50/50 transition-shadow hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-800">
                      <ShieldAlert className="h-5 w-5" />
                      {portfolio.total_sla_breaches} SLA Breach
                      {portfolio.total_sla_breaches !== 1 ? "es" : ""}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-red-700">
                      SLA targets have been breached or are approaching breach.
                      Click to review.
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
