"use client";

import { useState } from "react";
import { usePendingReviews, useReviewCommunication } from "@/hooks/use-communication-approvals";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, ClipboardList } from "lucide-react";
import type { Communication } from "@/types/communication";

function ReviewItem({ comm }: { comm: Communication }) {
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const reviewMutation = useReviewCommunication();

  const handleReview = (action: "approve" | "reject") => {
    reviewMutation.mutate({
      id: comm.id,
      data: { action, notes: notes || undefined },
    });
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium truncate">
              {comm.subject || "(No subject)"}
            </p>
            <Badge variant="outline">Pending Review</Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-3">
            {comm.body}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Submitted {new Date(comm.created_at).toLocaleDateString()}
            {comm.sender_name && ` by ${comm.sender_name}`}
          </p>
        </div>
      </div>

      {showNotes && (
        <Textarea
          placeholder="Add review notes (optional)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="text-sm"
        />
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="default"
          className="gap-1.5"
          onClick={() => handleReview("approve")}
          disabled={reviewMutation.isPending}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="gap-1.5"
          onClick={() => handleReview("reject")}
          disabled={reviewMutation.isPending}
        >
          <XCircle className="h-3.5 w-3.5" />
          Reject
        </Button>
        {!showNotes && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowNotes(true)}
          >
            Add Notes
          </Button>
        )}
      </div>
    </div>
  );
}

export function ReviewQueue() {
  const { data, isLoading } = usePendingReviews();
  const communications = data?.communications ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading review queue...</p>
      </div>
    );
  }

  if (communications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <h3 className="font-medium text-lg">No pending reviews</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Communications awaiting review will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {communications.map((comm: Communication) => (
        <ReviewItem key={comm.id} comm={comm} />
      ))}
    </div>
  );
}
