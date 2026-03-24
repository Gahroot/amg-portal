"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  usePortfolioSummary,
  useAtRiskPrograms,
  useRealTimeStats,
  useActivityFeed,
  useDashboardAlerts,
} from "@/hooks/use-dashboard";
import { ProgramHealthTable } from "@/components/dashboard/program-health-table";
import { StatsBar } from "@/components/dashboard/stats-bar";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { QuickActionsBar } from "@/components/dashboard/quick-actions";
import { ExportDashboardButton } from "@/components/dashboard/export-dashboard-button";
import { UpcomingDatesWidget } from "@/components/dashboard/upcoming-dates-widget";
import { ExpiringDocumentsWidget } from "@/components/documents/expiring-documents-widget";
import { FavoriteReportsWidget } from "@/components/reports/report-favorites";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLE_LABELS } from "@/lib/constants";

// ============================================================================
// Loading skeleton
// ============================================================================

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// RAG breakdown
// ============================================================================

interface RagBreakdownProps {
  breakdown: Record<string, number>;
}

function RagBreakdown({ breakdown }: RagBreakdownProps) {
  const red = breakdown["red"] ?? 0;
  const amber = breakdown["amber"] ?? 0;
  const green = breakdown["green"] ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          RAG Status Breakdown
        </CardTitle>
        <CardDescription>
          Program health across your portfolio
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Badge
            variant="outline"
            className="gap-1.5 border-red-200 bg-red-50 px-3 py-1 text-sm text-red-800"
          >
            <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
            Red — {red} program{red !== 1 ? "s" : ""}
          </Badge>
          <Badge
            variant="outline"
            className="gap-1.5 border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-800"
          >
            <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
            Amber — {amber} program{amber !== 1 ? "s" : ""}
          </Badge>
          <Badge
            variant="outline"
            className="gap-1.5 border-green-200 bg-green-50 px-3 py-1 text-sm text-green-800"
          >
            <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
            Green — {green} program{green !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Legacy quick actions (kept for non-internal roles)
// ============================================================================

type QuickAction = {
  label: string;
  href: string;
  variant: "default" | "outline" | "secondary";
};

function getQuickActions(role: string): QuickAction[] {
  const base: QuickAction[] = [
    { label: "View All Programs", href: "/programs", variant: "outline" },
  ];

  if (role === "managing_director" || role === "relationship_manager") {
    return [
      { label: "New Client", href: "/clients/new", variant: "default" },
      { label: "New Program", href: "/programs/new", variant: "secondary" },
      ...base,
    ];
  }

  if (role === "coordinator") {
    return [
      { label: "New Program", href: "/programs/new", variant: "default" },
      ...base,
      { label: "View Escalations", href: "/escalations", variant: "outline" },
    ];
  }

  if (role === "finance_compliance") {
    return [
      ...base,
      { label: "View SLA Breaches", href: "/sla", variant: "outline" },
      { label: "Pending Decisions", href: "/decisions", variant: "outline" },
    ];
  }

  return base;
}

function QuickActions({ role }: { role: string }) {
  const actions = getQuickActions(role);

  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <Button key={action.href} variant={action.variant} asChild>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ))}
    </div>
  );
}

// ============================================================================
// Role-gated metric grid (kept for portfolio summary view)
// ============================================================================

interface MetricCardProps {
  title: string;
  value: number;
  description?: string;
  icon: React.ReactNode;
  alert?: boolean;
}

function MetricCard({
  title,
  value,
  description,
  icon,
  alert = false,
}: MetricCardProps) {
  return (
    <Card
      className={
        alert && value > 0 ? "border-red-300 bg-red-50 dark:bg-red-950/20" : ""
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={`text-sm font-medium ${
            alert && value > 0 ? "text-red-700" : "text-muted-foreground"
          }`}
        >
          {title}
        </CardTitle>
        <span
          className={`h-4 w-4 ${
            alert && value > 0 ? "text-red-600" : "text-muted-foreground"
          }`}
        >
          {icon}
        </span>
      </CardHeader>
      <CardContent>
        <p
          className={`text-2xl font-bold ${
            alert && value > 0 ? "text-red-700" : ""
          }`}
        >
          {value}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main page
// ============================================================================

export default function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const isInternal = [
    "managing_director",
    "relationship_manager",
    "coordinator",
    "finance_compliance",
  ].includes(role);

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = usePortfolioSummary();

  const {
    data: atRisk,
    isLoading: atRiskLoading,
    isError: atRiskError,
  } = useAtRiskPrograms();

  const {
    data: realTimeStats,
    isLoading: statsLoading,
  } = useRealTimeStats();

  const {
    data: activityFeed,
    isLoading: feedLoading,
  } = useActivityFeed();

  const {
    data: alertsData,
    isLoading: alertsLoading,
  } = useDashboardAlerts();

  const isLoading = summaryLoading || atRiskLoading;

  return (
    <div id="dashboard-content" className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Welcome back, {user?.full_name?.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ROLE_LABELS[role] ?? role} · {user?.email}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isInternal ? (
            <QuickActionsBar role={role} />
          ) : (
            <QuickActions role={role} />
          )}
          <ExportDashboardButton title="Portfolio Overview" />
        </div>
      </div>

      {/* Real-time stats bar */}
      {isInternal && (
        <StatsBar stats={realTimeStats} isLoading={statsLoading} />
      )}

      {/* Loading state */}
      {isLoading && <DashboardSkeleton />}

      {/* Error state */}
      {!isLoading && (summaryError || atRiskError) && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Unable to load dashboard data. Please refresh the page.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loaded state */}
      {!isLoading && summary && (
        <>
          {/* RAG breakdown — show to all internal roles */}
          {role !== "client" && role !== "partner" && (
            <RagBreakdown breakdown={summary.rag_breakdown} />
          )}

          {/* Upcoming dates widget — RMs and MDs only */}
          {(role === "managing_director" || role === "relationship_manager") && (
            <UpcomingDatesWidget />
          )}

          {/* Expiring documents widget — internal roles */}
          {isInternal && <ExpiringDocumentsWidget limit={5} />}

          {/* Favorite reports widget — RMs and MDs only */}
          {(role === "managing_director" || role === "relationship_manager") && (
            <FavoriteReportsWidget />
          )}

          {/* Activity feed + Alerts side by side */}
          {isInternal && (
            <div className="grid gap-6 lg:grid-cols-2">
              <ActivityFeed
                items={activityFeed?.items}
                isLoading={feedLoading}
              />
              <AlertsPanel
                alerts={alertsData?.alerts}
                isLoading={alertsLoading}
              />
            </div>
          )}

          {/* At-risk programs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                At-Risk Programs
              </CardTitle>
              <CardDescription>
                Programs with red RAG status or active escalations requiring
                immediate attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {atRiskLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }, (_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : atRisk && atRisk.programs.length > 0 ? (
                <ProgramHealthTable programs={atRisk.programs} />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No at-risk programs. All programs are on track.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
