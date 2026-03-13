"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  // Capability review statuses
  pending: { label: "Pending", variant: "secondary" },
  scheduled: { label: "Scheduled", variant: "default" },
  in_progress: { label: "In Progress", variant: "default" },
  completed: { label: "Completed", variant: "outline" },
  overdue: { label: "Overdue", variant: "destructive" },
  waived: { label: "Waived", variant: "secondary" },
  // Access audit statuses
  draft: { label: "Draft", variant: "secondary" },
  in_review: { label: "In Review", variant: "default" },
  // Finding statuses
  open: { label: "Open", variant: "destructive" },
  acknowledged: { label: "Acknowledged", variant: "default" },
  remediated: { label: "Remediated", variant: "outline" },
  closed: { label: "Closed", variant: "outline" },
  // Common
  active: { label: "Active", variant: "default" },
  archived: { label: "Archived", variant: "outline" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status.replace(/_/g, " "),
    variant: "outline" as const,
  };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
