"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { EscalationDetailedMetrics } from "@/types/escalation";
import { LEVEL_COLORS, LEVEL_LABELS } from "./constants";

interface RecurringCardProps {
  isLoading: boolean;
  patterns: EscalationDetailedMetrics["recurring_patterns"] | undefined;
}

export function RecurringCard({ isLoading, patterns }: RecurringCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Recurring Escalations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !patterns?.length ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No recurring escalations in this period.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {patterns.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium capitalize">{p.entity_type}</span>
                  <span className="text-muted-foreground text-xs ml-2">
                    {p.entity_id.slice(0, 8)}…
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] capitalize"
                    style={{
                      borderColor: LEVEL_COLORS[p.level],
                      color: LEVEL_COLORS[p.level],
                    }}
                  >
                    {LEVEL_LABELS[p.level] ?? p.level}
                  </Badge>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    ×{p.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
