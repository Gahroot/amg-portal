"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { EscalationDetailedMetrics } from "@/types/escalation";

interface AssigneesCardProps {
  isLoading: boolean;
  assignees: EscalationDetailedMetrics["by_assignee"] | undefined;
}

export function AssigneesCard({ isLoading, assignees }: AssigneesCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-base">
          Top Assignees by Volume
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : !assignees?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No assignee data
          </p>
        ) : (
          <div className="space-y-2">
            {assignees.slice(0, 6).map((a) => {
              const maxCount = assignees[0]?.count ?? 1;
              const pct = Math.round((a.count / maxCount) * 100);
              return (
                <div key={a.owner_id} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 truncate text-xs font-medium">
                    {a.owner_name ?? a.owner_email ?? a.owner_id.slice(0, 8)}
                  </div>
                  <div className="flex-1 rounded-full bg-muted h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground w-6 text-right">
                    {a.count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
