"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { TimelineMilestone, type MilestoneDisplayState } from "./timeline-milestone";
import type { ClientPortalMilestone, ClientPortalProgramDetail } from "@/lib/api/client-portal";

export interface ProgramTimelineProps {
  program: ClientPortalProgramDetail;
  /** "full" shows labels, descriptions; "compact" is icon-only (for cards) */
  variant?: "full" | "compact";
  className?: string;
}

function getMilestoneState(
  milestone: ClientPortalMilestone
): MilestoneDisplayState {
  if (milestone.status === "completed" || milestone.status === "cancelled") {
    return "completed";
  }
  if (milestone.status === "in_progress") {
    // Check if overdue
    if (milestone.due_date && new Date(milestone.due_date) < new Date()) {
      return "overdue";
    }
    return "current";
  }
  // pending — check if overdue
  if (milestone.due_date && new Date(milestone.due_date) < new Date()) {
    return "overdue";
  }
  return "upcoming";
}

/**
 * Compute connector fill between node[i] and node[i+1].
 * 1 = fully filled (green), 0 = empty.
 */
function getConnectorFill(
  milestones: ClientPortalMilestone[],
  index: number
): number {
  const current = milestones[index];
  const next = milestones[index + 1];
  if (!next) return 0;

  const currentState = getMilestoneState(current);

  // Connector is fully filled if current is completed
  if (currentState === "completed") return 1;
  // Connector is partially filled if current is in-progress
  if (currentState === "current") return 0.5;
  return 0;
}

// Full variant: vertical timeline with labels
function FullTimeline({
  milestones,
  className,
}: {
  milestones: ClientPortalMilestone[];
  className?: string;
}) {
  const sorted = [...milestones].sort((a, b) => a.position - b.position);

  return (
    <div className={cn("flex flex-col", className)}>
      {sorted.map((milestone, i) => {
        const isLast = i === sorted.length - 1;
        const state = getMilestoneState(milestone);
        const fill = getConnectorFill(sorted, i);

        const labelColor =
          state === "completed"
            ? "text-green-700 dark:text-green-300"
            : state === "current"
              ? "text-primary font-semibold"
              : state === "overdue"
                ? "text-red-600 dark:text-red-400 font-semibold"
                : "text-muted-foreground";

        const dateColor =
          state === "overdue" ? "text-red-500" : "text-muted-foreground";

        return (
          <div key={milestone.id} className="flex gap-4">
            {/* Timeline spine */}
            <TimelineMilestone
              milestone={milestone}
              displayState={state}
              isLast={isLast}
              connectorFill={fill}
            />

            {/* Content */}
            <div className={cn("flex-1 pb-6 pt-1", isLast && "pb-0")}>
              <p className={cn("text-sm leading-snug", labelColor)}>
                {milestone.title}
              </p>
              {milestone.due_date && (
                <p className={cn("text-xs mt-0.5", dateColor)}>
                  {state === "overdue" ? "Overdue · " : "Due · "}
                  {new Date(milestone.due_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
              {milestone.description && state === "current" && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {milestone.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Compact variant: horizontal dots strip for list cards
function CompactTimeline({
  milestones,
  className,
}: {
  milestones: ClientPortalMilestone[];
  className?: string;
}) {
  const sorted = [...milestones].sort((a, b) => a.position - b.position);
  const total = sorted.length;
  if (total === 0) return null;

  const completedCount = sorted.filter(
    (m) => m.status === "completed" || m.status === "cancelled"
  ).length;
  const currentIdx = sorted.findIndex((m) => m.status === "in_progress");

  return (
    <div className={cn("flex items-center gap-0 w-full", className)}>
      {sorted.map((milestone, i) => {
        const isLast = i === total - 1;
        const state = getMilestoneState(milestone);

        const dotColor =
          state === "completed"
            ? "bg-green-500"
            : state === "current"
              ? "bg-primary ring-2 ring-primary/30"
              : state === "overdue"
                ? "bg-red-500 ring-2 ring-red-200"
                : "bg-muted-foreground/20 border border-muted-foreground/30";

        const lineColor =
          i < completedCount - 1 ||
          (i === completedCount - 1 && currentIdx === -1)
            ? "bg-green-400"
            : state === "completed" && i === completedCount - 1
              ? "bg-green-400/60"
              : "bg-muted-foreground/15";

        return (
          <Fragment key={milestone.id}>
            <div
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full transition-all",
                dotColor
              )}
              title={`${milestone.title} — ${state}`}
            />
            {!isLast && (
              <div className={cn("h-0.5 flex-1 transition-all", lineColor)} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

export function ProgramTimeline({
  program,
  variant = "full",
  className,
}: ProgramTimelineProps) {
  const milestones = program.milestones ?? [];

  if (milestones.length === 0) {
    if (variant === "compact") return null;
    return (
      <p className="text-sm text-muted-foreground py-2">No milestones defined yet.</p>
    );
  }

  if (variant === "compact") {
    return <CompactTimeline milestones={milestones} className={className} />;
  }

  return <FullTimeline milestones={milestones} className={className} />;
}
