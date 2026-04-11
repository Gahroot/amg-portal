import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
} from "lucide-react";
import { createElement, type ReactNode } from "react";
import type { CalendarEvent } from "@/lib/api/partner-portal";

export type ViewMode = "month" | "week" | "list";

export interface StatusConfig {
  label: string;
  icon: ReactNode;
  dotColor: string;
  textColor: string;
}

export const ASSIGNMENT_STATUS_CONFIG: Record<string, StatusConfig> = {
  draft: {
    label: "Draft",
    icon: createElement(Circle, {
      className: "h-3.5 w-3.5 text-muted-foreground",
    }),
    dotColor: "bg-muted-foreground",
    textColor: "text-muted-foreground",
  },
  dispatched: {
    label: "Dispatched",
    icon: createElement(Clock, { className: "h-3.5 w-3.5 text-blue-500" }),
    dotColor: "bg-blue-500",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  accepted: {
    label: "Accepted",
    icon: createElement(Clock, { className: "h-3.5 w-3.5 text-amber-500" }),
    dotColor: "bg-amber-500",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  in_progress: {
    label: "In Progress",
    icon: createElement(Clock, { className: "h-3.5 w-3.5 text-amber-500" }),
    dotColor: "bg-amber-500",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  completed: {
    label: "Completed",
    icon: createElement(CheckCircle2, {
      className: "h-3.5 w-3.5 text-green-600 dark:text-green-400",
    }),
    dotColor: "bg-green-500",
    textColor: "text-green-600 dark:text-green-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: createElement(XCircle, {
      className: "h-3.5 w-3.5 text-muted-foreground",
    }),
    dotColor: "bg-muted-foreground/40",
    textColor: "text-muted-foreground",
  },
};

export const DELIVERABLE_STATUS_CONFIG: Record<string, StatusConfig> = {
  pending: {
    label: "Pending",
    icon: createElement(Circle, {
      className: "h-3.5 w-3.5 text-muted-foreground",
    }),
    dotColor: "bg-muted-foreground",
    textColor: "text-muted-foreground",
  },
  submitted: {
    label: "Submitted",
    icon: createElement(Clock, { className: "h-3.5 w-3.5 text-blue-500" }),
    dotColor: "bg-blue-500",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  under_review: {
    label: "Under Review",
    icon: createElement(AlertCircle, {
      className: "h-3.5 w-3.5 text-amber-500",
    }),
    dotColor: "bg-amber-500",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  approved: {
    label: "Approved",
    icon: createElement(CheckCircle2, {
      className: "h-3.5 w-3.5 text-green-600 dark:text-green-400",
    }),
    dotColor: "bg-green-500",
    textColor: "text-green-600 dark:text-green-400",
  },
  returned: {
    label: "Returned",
    icon: createElement(AlertCircle, {
      className: "h-3.5 w-3.5 text-orange-500",
    }),
    dotColor: "bg-orange-500",
    textColor: "text-orange-600 dark:text-orange-400",
  },
  rejected: {
    label: "Rejected",
    icon: createElement(XCircle, { className: "h-3.5 w-3.5 text-red-500" }),
    dotColor: "bg-red-500",
    textColor: "text-red-600 dark:text-red-400",
  },
};

export function getStatusConfig(event: CalendarEvent): StatusConfig {
  if (event.type === "assignment") {
    return (
      ASSIGNMENT_STATUS_CONFIG[event.status] ?? ASSIGNMENT_STATUS_CONFIG.draft
    );
  }
  return (
    DELIVERABLE_STATUS_CONFIG[event.status] ?? DELIVERABLE_STATUS_CONFIG.pending
  );
}

// Consistent program colors assigned by index
export const PROGRAM_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-rose-500",
];

export const DONE_STATUSES = new Set([
  "completed",
  "approved",
  "cancelled",
  "rejected",
]);
