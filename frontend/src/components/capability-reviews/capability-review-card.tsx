"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CapabilityReview } from "@/types/capability-review";

interface CapabilityReviewCardProps {
  review: CapabilityReview;
}

export function CapabilityReviewCard({ review }: CapabilityReviewCardProps) {
  const router = useRouter();
  const findingsCount = review.findings?.length ?? 0;
  const criticalCount =
    review.findings?.filter((f) => f.severity === "critical").length ?? 0;

  return (
    <div
      className="cursor-pointer rounded-lg border bg-white p-5 transition-shadow hover:shadow-md"
      onClick={() => router.push(`/capability-reviews/${review.id}`)}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-medium">{review.partner_name || "Unknown Partner"}</h3>
          <p className="text-sm text-muted-foreground">
            Year: {review.review_year}
          </p>
        </div>
        <StatusBadge status={review.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">Reviewer</p>
          <p className="font-medium">{review.reviewer_name || "Unassigned"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Scheduled</p>
          <p className="font-medium">
            {review.scheduled_date
              ? new Date(review.scheduled_date).toLocaleDateString()
              : "Not set"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Findings</p>
          <div className="flex items-center gap-2">
            <span className="font-medium">{findingsCount}</span>
            {criticalCount > 0 && (
              <Badge variant="destructive">{criticalCount} critical</Badge>
            )}
          </div>
        </div>
        <div>
          <p className="text-muted-foreground">Completed</p>
          <p className="font-medium">
            {review.completed_date
              ? new Date(review.completed_date).toLocaleDateString()
              : "-"}
          </p>
        </div>
      </div>

      {review.capabilities_reviewed && review.capabilities_reviewed.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {review.capabilities_reviewed.slice(0, 3).map((cap) => (
            <Badge key={cap} variant="outline" className="text-xs">
              {cap}
            </Badge>
          ))}
          {review.capabilities_reviewed.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{review.capabilities_reviewed.length - 3} more
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
