"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import {
  useDeletionRequests,
  useApproveDeletionRequest,
  useRejectDeletionRequest,
} from "@/hooks/use-deletion-requests";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DeletionRequest } from "@/types/deletion-request";

const ALLOWED_ROLES = ["managing_director", "finance_compliance"];

function statusBadgeVariant(
  status: DeletionRequest["status"],
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "pending":
      return "secondary";
    case "approved":
      return "default";
    case "rejected":
      return "destructive";
    case "expired":
      return "outline";
    default:
      return "outline";
  }
}

function formatEntity(entityType: string): string {
  return entityType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface AuthorizeDialogProps {
  request: DeletionRequest;
  onConfirm: () => void;
  isPending: boolean;
  currentUserId: string;
}

function AuthorizeDialog({
  request,
  onConfirm,
  isPending,
  currentUserId,
}: AuthorizeDialogProps) {
  const isSelf = request.requested_by === currentUserId;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="destructive"
          disabled={isSelf || isPending}
          title={
            isSelf
              ? "You cannot authorize your own deletion request (two-person rule)"
              : undefined
          }
        >
          Authorize
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            ⚠ Authorize Permanent Deletion
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                You are about to authorize the permanent soft-deletion of:
              </p>
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-1">
                <div>
                  <span className="font-medium">Entity type:</span>{" "}
                  {formatEntity(request.entity_type)}
                </div>
                <div>
                  <span className="font-medium">Entity ID:</span>{" "}
                  <code className="text-xs">{request.entity_id}</code>
                </div>
                <div>
                  <span className="font-medium">Reason:</span> {request.reason}
                </div>
              </div>
              <p className="font-semibold text-destructive">
                This action satisfies the two-person authorization requirement
                and cannot be undone. An audit record will be created.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={onConfirm}
          >
            {isPending ? "Authorizing…" : "Yes, Authorize Deletion"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface RejectDialogProps {
  request: DeletionRequest;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}

function RejectDialog({ request, onConfirm, isPending }: RejectDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const handleConfirm = () => {
    if (reason.trim().length < 5) {
      setError("Rejection reason must be at least 5 characters.");
      return;
    }
    onConfirm(reason.trim());
    setOpen(false);
    setReason("");
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Deletion Request</DialogTitle>
          <DialogDescription>
            Rejecting the deletion request for{" "}
            <strong>{formatEntity(request.entity_type)}</strong> (
            <code className="text-xs">{request.entity_id}</code>). Please
            provide a reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="rejection-reason">Rejection reason</Label>
          <Textarea
            id="rejection-reason"
            placeholder="Explain why this request is being rejected…"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            rows={3}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Rejecting…" : "Reject Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RequestTableProps {
  requests: DeletionRequest[];
  showActions: boolean;
  currentUserId: string;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  approvePending: boolean;
  rejectPending: boolean;
}

function RequestTable({
  requests,
  showActions,
  currentUserId,
  onApprove,
  onReject,
  approvePending,
  rejectPending,
}: RequestTableProps) {
  if (requests.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        No deletion requests found.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Entity Type</TableHead>
            <TableHead>Entity ID</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead>Status</TableHead>
            {showActions && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((req) => (
            <TableRow key={req.id}>
              <TableCell className="font-medium">
                {formatEntity(req.entity_type)}
              </TableCell>
              <TableCell>
                <code className="text-xs text-muted-foreground">
                  {req.entity_id.slice(0, 8)}…
                </code>
              </TableCell>
              <TableCell className="max-w-xs truncate" title={req.reason}>
                {req.reason}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {new Date(req.requested_at).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell>
                <Badge variant={statusBadgeVariant(req.status)}>
                  {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                </Badge>
              </TableCell>
              {showActions && req.status === "pending" && (
                <TableCell>
                  <div className="flex items-center gap-2">
                    <AuthorizeDialog
                      request={req}
                      onConfirm={() => onApprove(req.id)}
                      isPending={approvePending}
                      currentUserId={currentUserId}
                    />
                    <RejectDialog
                      request={req}
                      onConfirm={(reason) => onReject(req.id, reason)}
                      isPending={rejectPending}
                    />
                  </div>
                </TableCell>
              )}
              {showActions && req.status !== "pending" && (
                <TableCell>
                  <span className="text-xs text-muted-foreground">—</span>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function DeletionRequestsPage() {
  const { user } = useAuth();

  const { data: pendingData, isLoading: pendingLoading } = useDeletionRequests(
    { status: "pending" },
  );
  const { data: allData, isLoading: allLoading } = useDeletionRequests();

  const approveMutation = useApproveDeletionRequest();
  const rejectMutation = useRejectDeletionRequest();

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const handleApprove = (id: string) => {
    approveMutation.mutate(id);
  };

  const handleReject = (id: string, reason: string) => {
    rejectMutation.mutate({ id, data: { reason } });
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              Deletion Requests
            </h1>
            <p className="text-sm text-muted-foreground">
              All deletions require two-person authorization. Every action is
              permanently logged for compliance.
            </p>
          </div>
          <Button asChild>
            <Link href="/deletion-requests/new">New Request</Link>
          </Button>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending Authorization
              {pendingData && pendingData.total > 0 && (
                <span className="ml-2 rounded-full bg-destructive px-1.5 py-0.5 text-xs font-semibold text-destructive-foreground">
                  {pendingData.total}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">All Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {pendingLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <RequestTable
                  requests={pendingData?.requests ?? []}
                  showActions={user.role === "managing_director"}
                  currentUserId={user.id}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  approvePending={approveMutation.isPending}
                  rejectPending={rejectMutation.isPending}
                />
                {pendingData && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {pendingData.total} pending request
                    {pendingData.total !== 1 ? "s" : ""}
                  </p>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            {allLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <RequestTable
                  requests={allData?.requests ?? []}
                  showActions={user.role === "managing_director"}
                  currentUserId={user.id}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  approvePending={approveMutation.isPending}
                  rejectPending={rejectMutation.isPending}
                />
                {allData && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {allData.total} total request{allData.total !== 1 ? "s" : ""}
                  </p>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
