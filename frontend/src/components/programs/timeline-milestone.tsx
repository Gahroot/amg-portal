"use client";

import * as React from "react";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { ClientPortalMilestone } from "@/lib/api/client-portal";

export type MilestoneDisplayState = "completed" | "current" | "overdue" | "upcoming";

export interface TimelineMilestoneProps {
  milestone: ClientPortalMilestone;
  displayState: MilestoneDisplayState;
  isLast: boolean;
  /** 0–1 fill of the connector line after this node */
  connectorFill: number;
}

const STATE_STYLES: Record<
  MilestoneDisplayState,
  { dot: string; label: string }
> = {
  completed: {
    dot: "bg-green-600 border-green-600 shadow-sm shadow-green-200",
    label: "Completed",
  },
  current: {
    dot: "bg-primary border-primary ring-4 ring-primary/20 shadow-md",
    label: "In Progress",
  },
  overdue: {
    dot: "bg-red-500 border-red-500 ring-4 ring-red-200 shadow-md",
    label: "Overdue",
  },
  upcoming: {
    dot: "bg-background border-2 border-muted-foreground/30",
    label: "Upcoming",
  },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "No due date";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TimelineMilestone({
  milestone,
  displayState,
  isLast,
  connectorFill,
}: TimelineMilestoneProps) {
  const [open, setOpen] = React.useState(false);
  const styles = STATE_STYLES[displayState];

  const statusLabel =
    milestone.status === "completed"
      ? "Completed"
      : milestone.status === "in_progress"
        ? "In Progress"
        : milestone.status === "cancelled"
          ? "Cancelled"
          : "Pending";

  const badgeVariant: "default" | "secondary" | "outline" | "destructive" =
    displayState === "completed"
      ? "secondary"
      : displayState === "overdue"
        ? "destructive"
        : displayState === "current"
          ? "default"
          : "outline";

  return (
    <TooltipProvider>
      <div className="flex flex-col items-center relative">
        {/* Connector line above (except first) is handled by parent layout */}

        {/* Node */}
        <Tooltip open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 cursor-pointer",
                styles.dot,
                displayState === "upcoming" && "hover:border-muted-foreground/60"
              )}
              aria-label={`${milestone.title} — ${styles.label}`}
              onClick={() => setOpen((v) => !v)}
            >
              {/* Icon inside dot (smaller, overlaid) */}
              <span className="sr-only">{milestone.title}</span>
              {displayState === "completed" && (
                <CheckCircle2 className="h-4 w-4 text-white" />
              )}
              {displayState === "current" && (
                <Clock className="h-3.5 w-3.5 text-white" />
              )}
              {displayState === "overdue" && (
                <AlertCircle className="h-3.5 w-3.5 text-white" />
              )}
              {displayState === "upcoming" && (
                <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
              )}
            </button>
          </TooltipTrigger>

          <TooltipContent
            side="top"
            className="w-56 p-0 overflow-hidden rounded-lg shadow-lg"
          >
            <div className="bg-foreground text-background p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-sm leading-snug">{milestone.title}</p>
                <Badge variant={badgeVariant} className="shrink-0 text-xs px-1.5 py-0">
                  {statusLabel}
                </Badge>
              </div>

              {milestone.description && (
                <p className="text-xs text-background/70 line-clamp-3 leading-relaxed">
                  {milestone.description}
                </p>
              )}

              <div className="flex items-center gap-1 text-xs text-background/60">
                <Clock className="h-3 w-3" />
                <span>{formatDate(milestone.due_date)}</span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Connector line below */}
        {!isLast && (
          <div className="relative w-px flex-1 min-h-[40px] bg-muted-foreground/20 mt-1 mb-1 overflow-hidden">
            {/* Filled portion */}
            <div
              className="absolute top-0 left-0 right-0 bg-green-500 transition-all duration-500"
              style={{ height: `${connectorFill * 100}%` }}
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
