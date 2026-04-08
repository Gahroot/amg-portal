"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  acceptAssignment,
  declineAssignment,
  getAssignmentHistory,
  type Assignment,
  type AssignmentHistoryEntry,
} from "@/lib/api/assignments";

// ─── Offer deadline countdown ────────────────────────────────────────────────

function useOfferCountdown(offerExpiresAt: string | null): string | null {
  const [label, setLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!offerExpiresAt) return;

    const tick = () => {
      const diff = new Date(offerExpiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setLabel("Offer expired");
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setLabel(h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`);
    };

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [offerExpiresAt]);

  return label;
}

// ─── History timeline ─────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  dispatched: {
    label: "Dispatched",
    icon: <Clock className="h-3.5 w-3.5" />,
    color: "text-blue-600 dark:text-blue-400",
  },
  accepted: {
    label: "Accepted",
    icon: <CheckCircle className="h-3.5 w-3.5" />,
    color: "text-green-600 dark:text-green-400",
  },
  declined: {
    label: "Declined",
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: "text-red-600 dark:text-red-400",
  },
  expired: {
    label: "Offer expired",
    icon: <Clock className="h-3.5 w-3.5" />,
    color: "text-amber-600 dark:text-amber-400",
  },
};

function HistoryTimeline({ entries }: { entries: AssignmentHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">No history yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => {
        const cfg = EVENT_CONFIG[entry.event] ?? {
          label: entry.event,
          icon: <Clock className="h-3.5 w-3.5" />,
          color: "text-muted-foreground",
        };
        return (
          <li key={entry.id} className="flex gap-3">
            <span className={`mt-0.5 shrink-0 ${cfg.color}`}>{cfg.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-none">{cfg.label}</p>
              {entry.reason && (
                <p className="text-muted-foreground mt-1 text-xs">
                  &ldquo;{entry.reason}&rdquo;
                </p>
              )}
              <p className="text-muted-foreground mt-0.5 text-xs">
                {new Date(entry.created_at).toLocaleString()}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AssignmentActionsProps {
  assignment: Assignment;
  /** Called after a successful accept or decline so the parent can refresh. */
  onStatusChange?: () => void;
}

export function AssignmentActions({
  assignment,
  onStatusChange,
}: AssignmentActionsProps) {
  const queryClient = useQueryClient();
  const [declineOpen, setDeclineOpen] = React.useState(false);
  const [declineReason, setDeclineReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const countdown = useOfferCountdown(assignment.offer_expires_at);

  const { data: history = [] } = useQuery({
    queryKey: ["assignment-history", assignment.id],
    queryFn: () => getAssignmentHistory(assignment.id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["partner-portal", "assignments", assignment.id],
    });
    queryClient.invalidateQueries({
      queryKey: ["assignment-history", assignment.id],
    });
    onStatusChange?.();
  };

  const acceptMutation = useMutation({
    mutationFn: () => acceptAssignment(assignment.id),
    onSuccess: invalidate,
    onError: () => setError("Failed to accept assignment. Please try again."),
  });

  const declineMutation = useMutation({
    mutationFn: (reason: string) => declineAssignment(assignment.id, reason),
    onSuccess: () => {
      setDeclineOpen(false);
      setDeclineReason("");
      invalidate();
    },
    onError: () => setError("Failed to decline assignment. Please try again."),
  });

  const handleDeclineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineReason.trim()) return;
    setError(null);
    declineMutation.mutate(declineReason.trim());
  };

  const isDispatched = assignment.status === "dispatched";
  const isDeclined = assignment.status === "declined";
  const isAccepted = assignment.status === "accepted";

  return (
    <div className="space-y-4">
      {/* ── Offer deadline banner ── */}
      {isDispatched && countdown && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            Response deadline:{" "}
            <strong>
              {new Date(assignment.offer_expires_at!).toLocaleString()}
            </strong>{" "}
            ({countdown})
          </span>
        </div>
      )}

      {/* ── Action buttons ── */}
      {isDispatched && (
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setError(null);
              acceptMutation.mutate();
            }}
            disabled={acceptMutation.isPending || declineMutation.isPending}
          >
            <CheckCircle className="mr-1.5 h-4 w-4" />
            {acceptMutation.isPending ? "Accepting…" : "Accept Assignment"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setError(null);
              setDeclineOpen(true);
            }}
            disabled={acceptMutation.isPending || declineMutation.isPending}
          >
            <XCircle className="mr-1.5 h-4 w-4" />
            Decline
          </Button>
        </div>
      )}

      {/* ── Decline outcome ── */}
      {isDeclined && assignment.decline_reason && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm">
          <p className="font-medium text-red-800 dark:text-red-300">Declined</p>
          <p className="mt-1 text-red-700 dark:text-red-300">{assignment.decline_reason}</p>
          {assignment.declined_at && (
            <p className="mt-1 text-xs text-red-500">
              {new Date(assignment.declined_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* ── Accepted badge ── */}
      {isAccepted && assignment.accepted_at && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm text-green-800 dark:text-green-300">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>
            Accepted on{" "}
            <strong>{new Date(assignment.accepted_at).toLocaleString()}</strong>
          </span>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── History ── */}
      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            History
          </p>
          <HistoryTimeline entries={history} />
        </div>
      )}

      {/* ── Decline dialog ── */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Assignment</DialogTitle>
            <DialogDescription>
              Please provide a reason for declining{" "}
              <strong>{assignment.title}</strong>. This helps our team find an
              alternative partner quickly.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDeclineSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="decline-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="decline-reason"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g. Capacity constraints, outside area of expertise…"
                rows={4}
                required
                minLength={1}
                maxLength={2000}
              />
              <p className="text-muted-foreground text-xs">
                {declineReason.length}/2000
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeclineOpen(false)}
                disabled={declineMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={!declineReason.trim() || declineMutation.isPending}
              >
                {declineMutation.isPending ? "Declining…" : "Confirm Decline"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Re-export status badge helper for use in detail pages
export function AssignmentStatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "outline",
    dispatched: "secondary",
    accepted: "default",
    in_progress: "default",
    completed: "default",
    declined: "destructive",
    cancelled: "destructive",
  };
  return (
    <Badge variant={variants[status] ?? "outline"}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
