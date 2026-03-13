"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  getCapabilityReview,
  updateCapabilityReview,
  completeCapabilityReview,
} from "@/lib/api/capability-reviews";
import type { UpdateCapabilityReviewRequest, CompleteCapabilityReviewRequest } from "@/types/capability-review";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ALLOWED_ROLES = [
  "managing_director",
  "relationship_manager",
  "coordinator",
  "finance_compliance",
];

export default function CapabilityReviewDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const reviewId = params.id as string;

  const [editMode, setEditMode] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [recommendations, setRecommendations] = React.useState("");
  const [status, setStatus] = React.useState("");

  const { data: review, isLoading } = useQuery({
    queryKey: ["capability-review", reviewId],
    queryFn: () => getCapabilityReview(reviewId),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  React.useEffect(() => {
    if (review) {
      setNotes(review.notes || "");
      setRecommendations(review.recommendations || "");
      setStatus(review.status);
    }
  }, [review]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCapabilityReviewRequest) =>
      updateCapabilityReview(reviewId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["capability-review", reviewId],
      });
      queryClient.invalidateQueries({ queryKey: ["capability-reviews"] });
      setEditMode(false);
    },
  });

  const completeMutation = useMutation({
    mutationFn: (data: CompleteCapabilityReviewRequest) =>
      completeCapabilityReview(reviewId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["capability-review", reviewId],
      });
      queryClient.invalidateQueries({ queryKey: ["capability-reviews"] });
    },
  });

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Review not found.</p>
      </div>
    );
  }

  const handleSave = () => {
    updateMutation.mutate({
      notes,
      recommendations,
      status: status !== review.status ? status : undefined,
    });
  };

  const handleComplete = () => {
    completeMutation.mutate({
      notes,
      recommendations,
    });
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => router.back()}>
              ← Back
            </Button>
            <h1 className="font-serif text-3xl font-bold tracking-tight mt-2">
              Capability Review
            </h1>
            <p className="text-muted-foreground mt-1">
              {review.partner_name} - {review.review_year}
            </p>
          </div>
          <StatusBadge status={review.status} className="text-lg" />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Review Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Partner</p>
                <p className="text-lg">{review.partner_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Year</p>
                <p className="text-lg">{review.review_year}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reviewer</p>
                <p className="text-lg">{review.reviewer_name || "Unassigned"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Scheduled Date</p>
                <p className="text-lg">
                  {review.scheduled_date
                    ? new Date(review.scheduled_date).toLocaleDateString()
                    : "Not scheduled"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed Date</p>
                <p className="text-lg">
                  {review.completed_date
                    ? new Date(review.completed_date).toLocaleDateString()
                    : "-"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Items Reviewed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Capabilities ({review.capabilities_reviewed?.length || 0})
                </p>
                <p className="text-sm">
                  {review.capabilities_reviewed?.join(", ") || "None reviewed"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Certifications ({review.certifications_reviewed?.length || 0})
                </p>
                <p className="text-sm">
                  {review.certifications_reviewed?.join(", ") || "None reviewed"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Qualifications ({review.qualifications_reviewed?.length || 0})
                </p>
                <p className="text-sm">
                  {review.qualifications_reviewed?.join(", ") || "None reviewed"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Review Notes</CardTitle>
            {!editMode && review.status !== "completed" && (
              <Button variant="outline" onClick={() => setEditMode(true)}>
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {editMode ? (
              <>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="waived">Waived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea
                    className="mt-1"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Recommendations</label>
                  <Textarea
                    className="mt-1"
                    value={recommendations}
                    onChange={(e) => setRecommendations(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditMode(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Notes</p>
                  <p className="text-sm mt-1">{review.notes || "No notes"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Recommendations
                  </p>
                  <p className="text-sm mt-1">
                    {review.recommendations || "No recommendations"}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Findings */}
        {review.findings && review.findings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Findings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {review.findings.map((finding, idx) => (
                  <div
                    key={idx}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{finding.finding_type}</Badge>
                      <Badge
                        variant={
                          finding.severity === "critical"
                            ? "destructive"
                            : finding.severity === "high"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {finding.severity}
                      </Badge>
                    </div>
                    <p className="text-sm">{finding.description}</p>
                    {finding.recommendation && (
                      <p className="text-sm text-muted-foreground">
                        <strong>Recommendation:</strong> {finding.recommendation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complete Button */}
        {review.status !== "completed" && (
          <div className="flex justify-end">
            <Button
              onClick={handleComplete}
              disabled={completeMutation.isPending}
              size="lg"
            >
              {completeMutation.isPending ? "Completing..." : "Complete Review"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
