"use client";

import Link from "next/link";
import { AlertCircle, MessageSquare, CheckCircle2, ArrowRight, UserCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PortfolioProgramSummary } from "@/types/report";
import type { ClientPortalProfile } from "@/types/client";

interface ActionHighlightsProps {
  profile: ClientPortalProfile;
  pendingDecisionsTotal: number;
  unreadMessagesTotal: number;
  programs: PortfolioProgramSummary[];
}

function isProfileIncomplete(profile: ClientPortalProfile): boolean {
  return !profile.entity_type || !profile.jurisdiction;
}

function getOpenMilestonesCount(programs: PortfolioProgramSummary[]): number {
  return programs
    .filter((p) => p.status === "active" || p.status === "design" || p.status === "intake")
    .reduce((sum, p) => sum + Math.max(0, p.milestone_count - p.completed_milestone_count), 0);
}

function getUrgentProgramsCount(programs: PortfolioProgramSummary[]): number {
  return programs.filter(
    (p) =>
      (p.status === "active" || p.status === "design" || p.status === "intake") &&
      (p.rag_status === "red" || p.rag_status === "amber"),
  ).length;
}

interface ActionItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  href: string;
  urgent?: boolean;
}

export function ActionHighlights({
  profile,
  pendingDecisionsTotal,
  unreadMessagesTotal,
  programs,
}: ActionHighlightsProps) {
  const openMilestones = getOpenMilestonesCount(programs);
  const urgentPrograms = getUrgentProgramsCount(programs);
  const profileIncomplete = isProfileIncomplete(profile);

  const actions: ActionItem[] = [];

  if (pendingDecisionsTotal > 0) {
    actions.push({
      id: "decisions",
      icon: <AlertCircle className="h-4 w-4 text-orange-500" />,
      label: `${pendingDecisionsTotal} decision${pendingDecisionsTotal !== 1 ? "s" : ""} waiting`,
      description: "Your input is required before we can proceed",
      href: "/portal/decisions",
      urgent: true,
    });
  }

  if (unreadMessagesTotal > 0) {
    actions.push({
      id: "messages",
      icon: <MessageSquare className="h-4 w-4 text-blue-500" />,
      label: `${unreadMessagesTotal} unread message${unreadMessagesTotal !== 1 ? "s" : ""}`,
      description: "New updates from your advisory team",
      href: "/portal/messages",
    });
  }

  if (urgentPrograms > 0) {
    actions.push({
      id: "programs",
      icon: <AlertCircle className="h-4 w-4 text-red-500" />,
      label: `${urgentPrograms} program${urgentPrograms !== 1 ? "s" : ""} need${urgentPrograms === 1 ? "s" : ""} attention`,
      description: "One or more programs have an elevated status",
      href: "/portal/programs",
      urgent: true,
    });
  } else if (openMilestones > 0) {
    actions.push({
      id: "milestones",
      icon: <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
      label: `${openMilestones} open milestone${openMilestones !== 1 ? "s" : ""} in progress`,
      description: "Track progress across your active programs",
      href: "/portal/programs",
    });
  }

  if (profileIncomplete) {
    actions.push({
      id: "profile",
      icon: <UserCircle2 className="h-4 w-4 text-muted-foreground" />,
      label: "Complete your profile",
      description: "Add missing details to keep your account up to date",
      href: "/portal/settings/profile",
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "reports",
      icon: <FileText className="h-4 w-4 text-muted-foreground" />,
      label: "Review the latest program update",
      description: "View status reports and recent program activity",
      href: "/portal/reports/portfolio",
    });
  }

  const primaryAction = actions[0];
  const secondaryActions = actions.slice(1);

  return (
    <div className="space-y-2">
      {/* Primary action — larger, more prominent */}
      <Link href={primaryAction.href}>
        <div
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-shadow hover:shadow-sm cursor-pointer ${
            primaryAction.urgent
              ? "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30"
              : "bg-muted/40"
          }`}
        >
          <div className="shrink-0">{primaryAction.icon}</div>
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm font-semibold ${
                primaryAction.urgent ? "text-orange-900 dark:text-orange-300" : ""
              }`}
            >
              {primaryAction.label}
            </p>
            <p
              className={`text-xs ${
                primaryAction.urgent
                  ? "text-orange-700 dark:text-orange-300"
                  : "text-muted-foreground"
              }`}
            >
              {primaryAction.description}
            </p>
          </div>
          <ArrowRight
            className={`h-4 w-4 shrink-0 ${
              primaryAction.urgent ? "text-orange-500" : "text-muted-foreground"
            }`}
          />
        </div>
      </Link>

      {/* Secondary actions — compact row */}
      {secondaryActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {secondaryActions.map((action) => (
            <Button
              key={action.id}
              asChild
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground"
            >
              <Link href={action.href}>
                {action.icon}
                {action.label}
              </Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
