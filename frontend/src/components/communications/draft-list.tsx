"use client";

import { useCommunicationsByStatus, useSubmitForReview } from "@/hooks/use-communication-approvals";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, FileText } from "lucide-react";
import type { Communication } from "@/types/communication";

function ApprovalBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "secondary",
    pending_review: "outline",
    approved: "default",
    rejected: "destructive",
    sent: "default",
  };
  const labels: Record<string, string> = {
    draft: "Draft",
    pending_review: "Pending Review",
    approved: "Approved",
    rejected: "Rejected",
    sent: "Sent",
  };

  return <Badge variant={variants[status] ?? "secondary"}>{labels[status] ?? status}</Badge>;
}

export function DraftList() {
  const { data, isLoading } = useCommunicationsByStatus("draft");
  const submitMutation = useSubmitForReview();

  const communications = data?.communications ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading drafts...</p>
      </div>
    );
  }

  if (communications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <h3 className="font-medium text-lg">No drafts</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Draft communications will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {communications.map((comm: Communication) => (
        <div key={comm.id} className="flex items-start justify-between gap-4 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium truncate">
                {comm.subject || "(No subject)"}
              </p>
              <ApprovalBadge status={comm.approval_status} />
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {comm.body}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(comm.created_at).toLocaleDateString()}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5"
            onClick={() => submitMutation.mutate(comm.id)}
            disabled={submitMutation.isPending}
          >
            <Send className="h-3.5 w-3.5" />
            Submit for Review
          </Button>
        </div>
      ))}
    </div>
  );
}
