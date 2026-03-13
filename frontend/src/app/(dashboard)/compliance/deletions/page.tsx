"use client";

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  useDeletionRequests,
  useApproveDeletionRequest,
  useRejectDeletionRequest,
} from "@/hooks/use-deletion-requests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { DeletionRequest } from "@/types/deletion-request";

const ALLOWED_ROLES = ["managing_director", "finance_compliance"];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
  executed: "secondary",
  expired: "secondary",
};

const ENTITY_LABELS: Record<string, string> = {
  client_profile: "Client Profile",
  document: "Document",
  program: "Program",
};

export default function DeletionRequestsPage() {
  const { user } = useAuth();
  const { data, isLoading } = useDeletionRequests();
  const approveMutation = useApproveDeletionRequest();
  const rejectMutation = useRejectDeletionRequest();

  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState<DeletionRequest | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  /** Whether the current user is the requester (two-person rule blocks self-approval). */
  function isSelfRequest(req: DeletionRequest): boolean {
    return user?.id === req.requested_by;
  }

  function openApproveDialog(request: DeletionRequest) {
    setSelectedRequest(request);
    setApproveDialogOpen(true);
  }

  function handleApprove() {
    if (!selectedRequest) return;
    approveMutation.mutate(selectedRequest.id, {
      onSuccess: () => {
        setApproveDialogOpen(false);
        setSelectedRequest(null);
      },
    });
  }

  function openRejectDialog(request: DeletionRequest) {
    setSelectedRequest(request);
    setRejectReason("");
    setRejectDialogOpen(true);
  }

  function handleReject() {
    if (!selectedRequest || !rejectReason.trim()) return;
    rejectMutation.mutate(
      { id: selectedRequest.id, data: { reason: rejectReason } },
      {
        onSuccess: () => {
          setRejectDialogOpen(false);
          setSelectedRequest(null);
        },
      }
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Deletion Requests
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Two-person authorization required — you cannot approve your own
            request. Approved deletions execute automatically after the
            retention window.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pending &amp; Recent Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Retention</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Purge Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.deletion_requests.map((req) => {
                      const selfRequest = isSelfRequest(req);
                      return (
                        <TableRow key={req.id}>
                          <TableCell className="font-medium">
                            {ENTITY_LABELS[req.entity_type] ?? req.entity_type}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {req.reason}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[req.status] ?? "outline"}>
                              {req.status}
                            </Badge>
                            {req.status === "rejected" && req.rejection_reason && (
                              <p className="text-muted-foreground mt-1 text-xs">
                                {req.rejection_reason}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>{req.retention_days} days</TableCell>
                          <TableCell>
                            {new Date(req.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {req.scheduled_purge_at
                              ? new Date(req.scheduled_purge_at).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {req.status === "pending" && (
                              <div className="space-y-1">
                                {selfRequest && (
                                  <p className="text-muted-foreground text-xs">
                                    You requested this — another authorized
                                    user must approve.
                                  </p>
                                )}
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => openApproveDialog(req)}
                                    disabled={
                                      selfRequest || approveMutation.isPending
                                    }
                                    title={
                                      selfRequest
                                        ? "Two-person rule: you cannot approve your own request"
                                        : "Approve deletion request"
                                    }
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => openRejectDialog(req)}
                                    disabled={rejectMutation.isPending}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {data?.deletion_requests.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-muted-foreground text-center"
                        >
                          No deletion requests found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {data && (
          <p className="text-muted-foreground text-sm">
            {data.total} request{data.total !== 1 ? "s" : ""} total
          </p>
        )}
      </div>

      {/* Approve confirmation dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion Approval</DialogTitle>
            <DialogDescription>
              You are approving the deletion of a{" "}
              <strong>
                {selectedRequest
                  ? ENTITY_LABELS[selectedRequest.entity_type] ??
                    selectedRequest.entity_type
                  : ""}
              </strong>
              . After the {selectedRequest?.retention_days}-day retention
              period the deletion will execute automatically. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approveMutation.isPending}
            >
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Deletion Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this deletion request. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
