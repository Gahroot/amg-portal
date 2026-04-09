"use client";

import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  // Program statuses
  intake: { label: "Intake", variant: "outline" },
  design: { label: "Design", variant: "secondary" },
  active: { label: "Active", variant: "default" },
  on_hold: { label: "On Hold", variant: "destructive" },
  completed: { label: "Completed", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
  archived: { label: "Archived", variant: "outline" },
  // Milestone statuses
  pending: { label: "Pending", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  // Task statuses
  todo: { label: "To Do", variant: "outline" },
  in_progress: { label: "In Progress", variant: "default" },
  blocked: { label: "Blocked", variant: "destructive" },
  done: { label: "Done", variant: "secondary" },
  // Approval statuses
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant} dot>{config.label}</Badge>;
}
