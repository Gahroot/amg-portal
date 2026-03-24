"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  BarChart2,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { usePortalProfile } from "@/hooks/use-clients";
import { usePortfolioOverview } from "@/hooks/use-reports";
import { useActiveNPSSurvey } from "@/hooks/use-nps-surveys";
import { usePendingDecisions } from "@/hooks/use-decisions";
import { useConversations } from "@/hooks/use-conversations";
import type { DecisionRequest } from "@/types/communication";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DecisionResponseDialog } from "@/components/decisions/decision-response-dialog";
import { ExportDashboardButton } from "@/components/dashboard/export-dashboard-button";
import { PersonalizedGreeting } from "@/components/portal/personalized-greeting";
import { ActionHighlights } from "@/components/portal/action-highlights";

const STATUS_LABELS: Record<string, string> = {
  approved: "Active",
  pending_review: "Under Review",
  under_review: "Under Review",
  pending_compliance: "Under Review",
  compliance_cleared: "Under Review",
  pending_md_approval: "Under Review",
  draft: "Pending",
  flagged: "Requires Attention",
  rejected: "Inactive",
};

const RAG_COLORS: Record<string, string> = {
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

const RAG_BADGE_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  green: "default",
  amber: "secondary",
  red: "destructive",
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function PortalDashboardPage() {
  const [respondingTo, setRespondingTo] = useState<DecisionRequest | null>(null);

  const { data: profile, isLoading: isLoadingProfile } = usePortalProfile();
  const { data: portfolio, isLoading: isLoadingPortfolio } = usePortfolioOverview();
  const { data: activeSurvey } = useActiveNPSSurvey();
  const { data: pendingData, isLoading: isLoadingDecisions } = usePendingDecisions({ limit: 3 });
  const { data: conversationsData, isLoading: isLoadingConversations } = useConversations({ limit: 5 });

  const isLoading = isLoadingProfile || isLoadingPortfolio;

  const pendingDecisions = pendingData?.decisions ?? [];
  const conversations = (conversationsData?.conversations ?? []).slice(0, 4);
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);

  const activePrograms = (portfolio?.programs ?? [])
    .filter(
      (p) =>
        p.status === "active" || p.status === "design" || p.status === "intake"
    )
    .slice(0, 3);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-14 w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-28" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader>
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-muted-foreground">Profile not available.</p>
      </div>
    );
  }

  return (
    <div id="dashboard-content" className="mx-auto max-w-4xl space-y-6">
      {/* Personalized greeting + export */}
      <div className="flex items-start justify-between gap-4">
        <PersonalizedGreeting
          name={profile.display_name || profile.legal_name}
        />
        <div className="shrink-0 pt-1">
          <ExportDashboardButton title="Client Dashboard" />
        </div>
      </div>

      {/* Time-sensitive action highlights */}
      <ActionHighlights
        profile={profile}
        pendingDecisionsTotal={pendingData?.total ?? pendingDecisions.length}
        unreadMessagesTotal={totalUnread}
        programs={portfolio?.programs ?? []}
      />

      {/* Survey prompt */}
      {activeSurvey && (
        <Link href="/portal/survey">
          <Card className="border-amber-200 bg-amber-50 hover:shadow-md transition-shadow cursor-pointer dark:border-amber-900/50 dark:bg-amber-950/20">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                <BarChart2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  Your quarterly feedback survey is ready
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Share your experience — it takes less than a minute
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Account Status + Profile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Account Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {STATUS_LABELS[profile.approval_status] ?? profile.approval_status}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Profile Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Entity Type</p>
              <p className="text-sm">{profile.entity_type || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Jurisdiction</p>
              <p className="text-sm">{profile.jurisdiction || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-sm">{profile.primary_email}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Program Cards with Progress Bars */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-serif text-lg">Active Programs</CardTitle>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
            >
              <Link href="/portal/programs">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activePrograms.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activePrograms.map((program) => {
                const ragColor =
                  RAG_COLORS[program.rag_status] ?? "bg-gray-400";
                const badgeVariant =
                  RAG_BADGE_VARIANTS[program.rag_status] ?? "outline";
                const progress =
                  program.milestone_count > 0
                    ? Math.round(
                        (program.completed_milestone_count /
                          program.milestone_count) *
                          100
                      )
                    : 0;

                return (
                  <Link
                    key={program.id}
                    href={`/portal/programs/${program.id}`}
                  >
                    <div className="rounded-lg border p-4 space-y-3 hover:shadow-sm transition-shadow cursor-pointer h-full">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${ragColor}`}
                          />
                          <h4 className="font-medium text-sm leading-snug line-clamp-2">
                            {program.title}
                          </h4>
                        </div>
                        <Badge
                          variant={badgeVariant}
                          className="shrink-0 capitalize text-xs"
                        >
                          {program.rag_status}
                        </Badge>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Milestones
                          </span>
                          <span>
                            {program.completed_milestone_count}/
                            {program.milestone_count}
                          </span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                        <p className="text-xs text-muted-foreground text-right">
                          {progress}% complete
                        </p>
                      </div>

                      {program.end_date && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Due{" "}
                          {new Date(program.end_date).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : portfolio ? (
            <p className="text-sm text-muted-foreground">
              No active programs at this time.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          )}

          {portfolio && portfolio.total_programs - activePrograms.length > 0 && (
            <p className="mt-4 text-xs text-muted-foreground text-center">
              +{portfolio.total_programs - activePrograms.length} more program
              {portfolio.total_programs - activePrograms.length !== 1
                ? "s"
                : ""}
              {" — "}
              <Link
                href="/portal/programs"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                view all
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pending Decisions + Recent Messages */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pending Decisions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="font-serif text-lg">Decisions</CardTitle>
                {pendingDecisions.length > 0 && (
                  <Badge
                    variant="destructive"
                    className="rounded-full px-2 py-0.5 text-xs"
                  >
                    {pendingDecisions.length}
                  </Badge>
                )}
              </div>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
              >
                <Link href="/portal/decisions">
                  View All <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingDecisions ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : pendingDecisions.length > 0 ? (
              <div className="space-y-3">
                {pendingDecisions.map((decision) => {
                  const isOverdue =
                    decision.deadline_date &&
                    new Date(decision.deadline_date) < new Date();
                  return (
                    <div
                      key={decision.id}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-start gap-2">
                        <AlertCircle
                          className={`h-4 w-4 mt-0.5 shrink-0 ${
                            isOverdue
                              ? "text-red-500"
                              : "text-orange-500"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug line-clamp-1">
                            {decision.title}
                          </p>
                          {decision.deadline_date && (
                            <p
                              className={`text-xs mt-0.5 ${
                                isOverdue
                                  ? "text-red-500"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {isOverdue ? "Overdue · " : "Due · "}
                              {new Date(
                                decision.deadline_date
                              ).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 h-7 text-xs px-2"
                          onClick={() => setRespondingTo(decision)}
                        >
                          Respond
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">
                  No pending decisions
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Messages */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="font-serif text-lg">Messages</CardTitle>
                {totalUnread > 0 && (
                  <Badge
                    variant="default"
                    className="rounded-full px-2 py-0.5 text-xs"
                  >
                    {totalUnread}
                  </Badge>
                )}
              </div>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
              >
                <Link href="/portal/messages">
                  View All <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingConversations ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : conversations.length > 0 ? (
              <div className="space-y-2">
                {conversations.map((conv) => {
                  const title =
                    conv.title ||
                    conv.participants
                      .filter((p) => p.role !== "client")
                      .map((p) => p.full_name)
                      .join(", ") ||
                    "Conversation";
                  const lastActivity =
                    conv.last_activity_at || conv.created_at;

                  return (
                    <Link key={conv.id} href="/portal/messages">
                      <div className="flex items-center gap-3 rounded-lg border p-3 hover:shadow-sm transition-shadow cursor-pointer">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm leading-snug line-clamp-1 ${
                              conv.unread_count > 0
                                ? "font-semibold"
                                : "font-medium"
                            }`}
                          >
                            {title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeTime(lastActivity)}
                          </p>
                        </div>
                        {conv.unread_count > 0 && (
                          <Badge className="shrink-0 rounded-full px-2 py-0.5 text-xs">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">
                  No messages yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/portal/reports/portfolio">
          <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Access status reports, completion summaries, and annual reviews
              </p>
              <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                View Reports <ArrowRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/portal/documents">
          <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View and sign your program documents and agreements
              </p>
              <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                View Documents <ArrowRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Decision Response Dialog */}
      {respondingTo && (
        <DecisionResponseDialog
          decision={respondingTo}
          open={!!respondingTo}
          onOpenChange={(open) => {
            if (!open) setRespondingTo(null);
          }}
        />
      )}
    </div>
  );
}
