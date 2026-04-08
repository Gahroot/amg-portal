"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";

const RAG_CONFIG: Record<string, { label: string; className: string }> = {
  green: {
    label: "Green",
    className: "bg-green-100 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 dark:bg-green-900/30",
  },
  amber: {
    label: "Amber",
    className: "bg-amber-100 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 dark:bg-amber-900/30",
  },
  red: {
    label: "Red",
    className: "bg-red-100 text-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 dark:bg-red-900/30",
  },
};

interface RagBadgeProps {
  status: "green" | "amber" | "red";
}

export function RagBadge({ status }: RagBadgeProps) {
  const config = RAG_CONFIG[status] ?? RAG_CONFIG.green;
  return (
    <Badge variant="outline" className={config.className} dot>
      {config.label}
    </Badge>
  );
}
