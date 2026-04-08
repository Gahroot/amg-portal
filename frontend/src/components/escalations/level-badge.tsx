"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";

const LEVEL_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  task: { label: "Task", className: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
  milestone: {
    label: "Milestone",
    className: "bg-amber-100 text-amber-800 hover:bg-amber-200",
  },
  program: {
    label: "Program",
    className: "bg-orange-100 text-orange-800 hover:bg-orange-200",
  },
  client_impact: {
    label: "Client Impact",
    className: "bg-red-100 text-red-800 hover:bg-red-200",
  },
};

interface EscalationLevelBadgeProps {
  level: string;
}

export function EscalationLevelBadge({ level }: EscalationLevelBadgeProps) {
  const config =
    LEVEL_CONFIG[level] || {
      label: level,
      className: "bg-gray-100 text-gray-800 hover:bg-gray-200",
    };
  return (
    <Badge variant="outline" className={config.className} dot>
      {config.label}
    </Badge>
  );
}
