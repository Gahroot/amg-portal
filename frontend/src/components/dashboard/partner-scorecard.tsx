"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PartnerScorecard as PartnerScorecardType } from "@/lib/api/dashboard";

function StarRating({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-sm text-muted-foreground">No ratings</span>;
  }

  const fullStars = Math.floor(score);
  const hasHalf = score - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: fullStars }, (_, i) => (
        <span key={`full-${i.toString()}`} className="text-amber-500">
          ★
        </span>
      ))}
      {hasHalf && <span className="text-amber-500">★</span>}
      {Array.from({ length: emptyStars }, (_, i) => (
        <span key={`empty-${i.toString()}`} className="text-muted-foreground/50">
          ★
        </span>
      ))}
      <span className="ml-1 text-sm text-muted-foreground">
        {score.toFixed(1)}
      </span>
    </div>
  );
}

interface PartnerScorecardProps {
  scorecard: PartnerScorecardType;
}

export function PartnerScorecardCard({ scorecard }: PartnerScorecardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{scorecard.firm_name}</CardTitle>
        <CardDescription>
          {scorecard.total_ratings} rating
          {scorecard.total_ratings !== 1 ? "s" : ""} |{" "}
          {scorecard.total_assignments} assignment
          {scorecard.total_assignments !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Overall
            </p>
            <StarRating score={scorecard.avg_overall} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Quality
            </p>
            <StarRating score={scorecard.avg_quality} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Timeliness
            </p>
            <StarRating score={scorecard.avg_timeliness} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Communication
            </p>
            <StarRating score={scorecard.avg_communication} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 border-t pt-4">
          <div className="text-center">
            <p className="text-2xl font-bold">
              {scorecard.completed_assignments}
            </p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {scorecard.active_assignments}
            </p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {scorecard.total_assignments}
            </p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
