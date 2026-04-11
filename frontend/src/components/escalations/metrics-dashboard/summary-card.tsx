"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: ReactNode;
  trend?: number | null;
  highlight?: "warn" | "ok" | "neutral";
}

export function SummaryCard({
  title,
  value,
  subtext,
  icon,
  trend,
  highlight,
}: SummaryCardProps) {
  const borderColor =
    highlight === "warn"
      ? "border-l-amber-500"
      : highlight === "ok"
        ? "border-l-emerald-500"
        : "border-l-border";

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground truncate">
              {title}
            </p>
            <p className="text-2xl font-light tabular-nums tracking-tight">{value}</p>
            {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
          </div>
          <div className="ml-3 mt-0.5 text-muted-foreground shrink-0">{icon}</div>
        </div>
        {trend !== undefined && trend !== null && (
          <div
            className={`mt-2 flex items-center gap-1 text-xs font-medium ${
              trend > 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {trend > 0 ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {Math.abs(trend)}% vs prior period
          </div>
        )}
      </CardContent>
    </Card>
  );
}
