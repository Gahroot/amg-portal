"use client";

import { Badge } from "@/components/ui/badge";

const BREACH_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  within_sla: { label: "Within SLA", variant: "default" },
  approaching_breach: {
    label: "At Risk",
    variant: "secondary",
  },
  breached: { label: "BREACHED", variant: "destructive" },
};

interface SLABreachBadgeProps {
  breachStatus: string;
}

export function SLABreachBadge({ breachStatus }: SLABreachBadgeProps) {
  const config =
    BREACH_CONFIG[breachStatus] || {
      label: breachStatus,
      variant: "outline" as const,
    };
  return <Badge variant={config.variant} dot>{config.label}</Badge>;
}
