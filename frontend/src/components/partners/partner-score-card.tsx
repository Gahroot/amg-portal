"use client";

import type { CompositeScore } from "@/types/partner-governance";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 70) return "text-green-700";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

function scoreBadgeVariant(
  status: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (!status || status === "good_standing") return "default";
  if (status === "warning") return "secondary";
  if (status === "probation") return "outline";
  return "destructive";
}

const ACTION_LABELS: Record<string, string> = {
  warning: "Warning",
  probation: "Probation",
  suspension: "Suspended",
  termination: "Terminated",
  reinstatement: "Reinstated",
  good_standing: "Good Standing",
};

export function PartnerScoreCard({ data }: { data: CompositeScore }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-serif text-lg">
            Composite Performance Score
          </CardTitle>
          <Badge variant={scoreBadgeVariant(data.current_governance_status)}>
            {ACTION_LABELS[data.current_governance_status ?? "good_standing"] ??
              data.current_governance_status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main score */}
        <div className="flex items-baseline gap-3">
          <span className={`text-4xl font-bold ${scoreColor(data.composite_score)}`}>
            {data.composite_score !== null
              ? data.composite_score.toFixed(1)
              : "N/A"}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>

        {/* Rating breakdown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Rating Score (60% weight)
            </span>
            <span className="font-medium">
              {data.avg_rating_score !== null
                ? `${(data.avg_rating_score * 20).toFixed(1)} / 100`
                : "No ratings"}
            </span>
          </div>
          <Progress
            value={
              data.avg_rating_score !== null ? data.avg_rating_score * 20 : 0
            }
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">
            {data.total_ratings} rating{data.total_ratings !== 1 ? "s" : ""} ·
            avg {data.avg_rating_score?.toFixed(2) ?? "–"} / 5.0
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              SLA Compliance (40% weight)
            </span>
            <span className="font-medium">
              {data.sla_compliance_rate !== null
                ? `${data.sla_compliance_rate.toFixed(1)}%`
                : "No SLA data"}
            </span>
          </div>
          <Progress
            value={data.sla_compliance_rate ?? 0}
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">
            {data.total_sla_tracked} tracked · {data.total_sla_breached}{" "}
            breached
          </p>
        </div>

        {/* Recommended action */}
        {data.recommended_action && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs font-medium text-amber-800">
              Recommended Action
            </p>
            <p className="text-sm font-semibold text-amber-900 capitalize">
              {data.recommended_action}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
