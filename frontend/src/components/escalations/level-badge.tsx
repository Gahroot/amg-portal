"use client";

import { Badge } from "@/components/ui/badge";

const LEVEL_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  task: { label: "Task", className: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/30" },
  milestone: {
    label: "Milestone",
    className: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/30",
  },
  program: {
    label: "Program",
    className: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/30",
  },
  client_impact: {
    label: "Client Impact",
    className: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/30",
  },
};

interface EscalationLevelBadgeProps {
  level: string;
}

export function EscalationLevelBadge({ level }: EscalationLevelBadgeProps) {
  const config =
    LEVEL_CONFIG[level] || {
      label: level,
      className: "bg-muted text-foreground hover:bg-muted",
    };
  return (
    <Badge variant="outline" className={config.className} dot>
      {config.label}
    </Badge>
  );
}
