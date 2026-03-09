"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  useClosureStatus,
  useInitiateClosure,
  useUpdateChecklist,
  useSubmitPartnerRating,
  usePartnerRatings,
  useCompleteClosure,
} from "@/hooks/use-closure";
import type { ChecklistItem } from "@/lib/api/closure";

// ---------------------------------------------------------------------------
// Star rating component
// ---------------------------------------------------------------------------

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-lg ${
            star <= value
              ? "text-yellow-500"
              : "text-gray-300"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function ClosureStatusBadge({ status }: { status: string }) {
  const variant =
    status === "completed"
      ? "default"
      : status === "in_progress"
        ? "secondary"
        : "outline";
  return <Badge variant={variant}>{status.replace("_", " ")}</Badge>;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ProgramClosurePage() {
  const params = useParams();
  const programId = params.id as string;

  const { data: closure, isLoading, error } = useClosureStatus(programId);
  const { data: ratings } = usePartnerRatings(programId);

  const initiateMutation = useInitiateClosure();
  const checklistMutation = useUpdateChecklist();
  const ratingMutation = useSubmitPartnerRating();
  const completeMutation = useCompleteClosure();

  // Local state for initiation notes
  const [initiateNotes, setInitiateNotes] = React.useState("");

  // Local state for partner rating form
  const [ratingForm, setRatingForm] = React.useState({
    partner_id: "",
    quality_score: 0,
    timeliness_score: 0,
    communication_score: 0,
    overall_score: 0,
    comments: "",
  });

  const resetRatingForm = () =>
    setRatingForm({
      partner_id: "",
      quality_score: 0,
      timeliness_score: 0,
      communication_score: 0,
      overall_score: 0,
      comments: "",
    });

  // ------------------------------------------------------------------
  // No closure yet — show initiation UI
  // ------------------------------------------------------------------

  const hasNoClosure = !isLoading && (error || !closure);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm text-muted-foreground">
            Loading closure status...
          </p>
        </div>
      </div>
    );
  }

  if (hasNoClosure) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Program Closure
          </h1>
          <Card>
            <CardHeader>
              <CardTitle>Initiate Closure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={initiateNotes}
                  onChange={(e) => setInitiateNotes(e.target.value)}
                  placeholder="Add any notes for the closure process..."
                />
              </div>
              <Button
                onClick={() =>
                  initiateMutation.mutate({
                    programId,
                    notes: initiateNotes || undefined,
                  })
                }
                disabled={initiateMutation.isPending}
              >
                {initiateMutation.isPending
                  ? "Initiating..."
                  : "Initiate Closure"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Closure exists — show full workflow
  // ------------------------------------------------------------------

  const checklist: ChecklistItem[] = closure?.checklist ?? [];
  const allChecked = checklist.every((item) => item.completed);
  const isCompleted = closure?.status === "completed";

  const handleChecklistToggle = (key: string, checked: boolean) => {
    const updated = checklist.map((item) =>
      item.key === key ? { ...item, completed: checked } : item,
    );
    checklistMutation.mutate({ programId, items: updated });
  };

  const handleSubmitRating = () => {
    if (
      !ratingForm.partner_id ||
      ratingForm.quality_score < 1 ||
      ratingForm.timeliness_score < 1 ||
      ratingForm.communication_score < 1 ||
      ratingForm.overall_score < 1
    ) {
      return;
    }
    ratingMutation.mutate(
      {
        programId,
        data: {
          partner_id: ratingForm.partner_id,
          quality_score: ratingForm.quality_score,
          timeliness_score: ratingForm.timeliness_score,
          communication_score: ratingForm.communication_score,
          overall_score: ratingForm.overall_score,
          comments: ratingForm.comments || undefined,
        },
      },
      { onSuccess: resetRatingForm },
    );
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Program Closure
          </h1>
          <ClosureStatusBadge status={closure?.status ?? "initiated"} />
        </div>

        {closure?.notes && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="mt-1 text-sm">{closure.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Checklist */}
        <Card>
          <CardHeader>
            <CardTitle>Closure Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklist.map((item) => (
              <div key={item.key} className="flex items-center gap-3">
                <Checkbox
                  id={item.key}
                  checked={item.completed}
                  disabled={isCompleted}
                  onCheckedChange={(checked) =>
                    handleChecklistToggle(item.key, checked === true)
                  }
                />
                <Label
                  htmlFor={item.key}
                  className={
                    item.completed
                      ? "text-muted-foreground line-through"
                      : ""
                  }
                >
                  {item.label}
                </Label>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Partner Ratings */}
        <Card>
          <CardHeader>
            <CardTitle>Partner Ratings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Existing ratings */}
            {ratings && ratings.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Submitted Ratings</p>
                {ratings.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-md border p-3 space-y-1"
                  >
                    <p className="text-sm font-medium">
                      Partner: {r.partner_id}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                      <span>Quality: {r.quality_score}/5</span>
                      <span>
                        Timeliness: {r.timeliness_score}/5
                      </span>
                      <span>
                        Communication: {r.communication_score}/5
                      </span>
                      <span>Overall: {r.overall_score}/5</span>
                    </div>
                    {r.comments && (
                      <p className="text-sm text-muted-foreground">
                        {r.comments}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* New rating form */}
            {!isCompleted && (
              <div className="space-y-4 rounded-md border p-4">
                <p className="text-sm font-medium">
                  Submit New Rating
                </p>
                <div className="space-y-2">
                  <Label>Partner ID</Label>
                  <Input
                    value={ratingForm.partner_id}
                    onChange={(e) =>
                      setRatingForm((prev) => ({
                        ...prev,
                        partner_id: e.target.value,
                      }))
                    }
                    placeholder="Enter partner profile ID"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Quality</Label>
                    <StarRating
                      value={ratingForm.quality_score}
                      onChange={(v) =>
                        setRatingForm((prev) => ({
                          ...prev,
                          quality_score: v,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Timeliness</Label>
                    <StarRating
                      value={ratingForm.timeliness_score}
                      onChange={(v) =>
                        setRatingForm((prev) => ({
                          ...prev,
                          timeliness_score: v,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Communication</Label>
                    <StarRating
                      value={ratingForm.communication_score}
                      onChange={(v) =>
                        setRatingForm((prev) => ({
                          ...prev,
                          communication_score: v,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Overall</Label>
                    <StarRating
                      value={ratingForm.overall_score}
                      onChange={(v) =>
                        setRatingForm((prev) => ({
                          ...prev,
                          overall_score: v,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Comments (optional)</Label>
                  <Textarea
                    value={ratingForm.comments}
                    onChange={(e) =>
                      setRatingForm((prev) => ({
                        ...prev,
                        comments: e.target.value,
                      }))
                    }
                    placeholder="Additional comments..."
                  />
                </div>
                <Button
                  onClick={handleSubmitRating}
                  disabled={
                    ratingMutation.isPending ||
                    !ratingForm.partner_id ||
                    ratingForm.quality_score < 1 ||
                    ratingForm.timeliness_score < 1 ||
                    ratingForm.communication_score < 1 ||
                    ratingForm.overall_score < 1
                  }
                >
                  {ratingMutation.isPending
                    ? "Submitting..."
                    : "Submit Rating"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Complete Closure */}
        {!isCompleted && (
          <Card>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="text-sm font-medium">
                  Finalize Closure
                </p>
                <p className="text-sm text-muted-foreground">
                  All checklist items must be completed before
                  finalizing.
                </p>
              </div>
              <Button
                onClick={() => completeMutation.mutate(programId)}
                disabled={
                  !allChecked || completeMutation.isPending
                }
              >
                {completeMutation.isPending
                  ? "Completing..."
                  : "Complete Closure"}
              </Button>
            </CardContent>
          </Card>
        )}

        {isCompleted && closure?.completed_at && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Closure completed on{" "}
                {new Date(closure.completed_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
