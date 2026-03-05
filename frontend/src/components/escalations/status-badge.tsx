"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";

const ESCALATION_STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  open: { label: "Open", variant: "destructive" },
  acknowledged: { label: "Acknowledged", variant: "default" },
  investigating: { label: "Investigating", variant: "secondary" },
  resolved: { label: "Resolved", variant: "outline" },
  closed: { label: "Closed", variant: "outline" },
};

interface EscalationStatusBadgeProps {
  status: string;
}

export function EscalationStatusBadge({ status }: EscalationStatusBadgeProps) {
  const config =
    ESCALATION_STATUS_CONFIG[status] || {
      label: status,
      variant: "outline" as const,
    };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
