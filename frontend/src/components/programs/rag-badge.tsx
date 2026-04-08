"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";

const RAG_CONFIG: Record<string, { label: string; className: string }> = {
  green: {
    label: "Green",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
  },
  amber: {
    label: "Amber",
    className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  },
  red: {
    label: "Red",
    className: "bg-red-100 text-red-800 hover:bg-red-100",
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
