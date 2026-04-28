"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, CheckCircle, Flag, ExternalLink } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { useClientProfiles } from "@/hooks/use-clients";
import { submitComplianceReview } from "@/lib/api/clients";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ClientProfile } from "@/types/client";
import { queryKeys } from "@/lib/query-keys";

const ALLOWED_ROLES = ["finance_compliance", "managing_director"];

// KYC status derived from compliance_status
function getKycBadge(status: string) {
  switch (status) {
    case "pending_review":
      return <Badge variant="secondary">Pending Review</Badge>;
    case "cleared":
      return <Badge variant="default" className="bg-emerald-500">Cleared</Badge>;
    case "flagged":
      return <Badge variant="outline" className="border-amber-500 text-amber-600">Flagged</Badge>;
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ─── Quick Action Dialog ──────────────────────────────────────────────────────

interface QuickActionDialogProps {
  profile: ClientProfile | null;
  action: "cleared" | "flagged" | null;
  onClose: () => void;
  onConfirm: (notes: string) => void;
  isPending: boolean;
}

function QuickActionDialog({
  profile,
  action,
  onClose,
  onConfirm,
  isPending,
}: QuickActionDialogProps) {
  const [notes, setNotes] = useState("");

  if (!profile || !action) return null;

  const isApprove = action === "cleared";

  return (
    <Dialog open={!!profile && !!action} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isApprove ? "Approve Compliance" : "Flag for Review"}
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? `Mark ${profile.legal_name} as compliance-cleared.`
              : `Flag ${profile.legal_name} for follow-up review.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="notes">
              Notes {isApprove ? "(optional)" : "(required — reason for flagging)"}
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={
                isApprove
                  ? "Any additional notes…"
                  : "Describe the issue requiring follow-up…"
              }
              required={!isApprove}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={isApprove ? "default" : "outline"}
            className={!isApprove ? "border-amber-500 text-amber-600 hover:bg-amber-50" : ""}
            onClick={() => onConfirm(notes)}
            disabled={isPending || (!isApprove && !notes.trim())}
          >
            {isPending
              ? "Saving…"
              : isApprove
                ? "Approve"
                : "Flag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ComplianceQueuePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [actionProfile, setActionProfile] = useState<ClientProfile | null>(null);
  const [actionType, setActionType] = useState<"cleared" | "flagged" | null>(null);

  const { data, isLoading } = useClientProfiles({
    compliance_status: statusFilter,
    search: search || undefined,
    limit: 100,
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: "cleared" | "flagged" | "rejected";
      notes: string;
    }) => submitComplianceReview(id, { status, notes }),
    onSuccess: (_, variables) => {
      const label = variables.status === "cleared" ? "approved" : "flagged";
      toast.success(`Profile ${label} successfully`);
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      setActionProfile(null);
      setActionType(null);
    },
    onError: () => toast.error("Failed to submit compliance review"),
  });

  const openAction = (profile: ClientProfile, action: "cleared" | "flagged") => {
    setActionProfile(profile);
    setActionType(action);
  };

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const profiles = data?.profiles ?? [];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              Compliance Queue
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review KYC status for client profiles pending compliance clearance.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {(
              [
                { value: "pending_review", label: "Pending" },
                { value: "flagged", label: "Flagged" },
                { value: "cleared", label: "Cleared" },
                { value: "rejected", label: "Rejected" },
              ] as const
            ).map(({ value, label }) => (
              <Button
                key={value}
                variant={statusFilter === value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Legal Name</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>KYC Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">
                      {profile.legal_name}
                    </TableCell>
                    <TableCell>{profile.entity_type ?? "-"}</TableCell>
                    <TableCell>{profile.jurisdiction ?? "-"}</TableCell>
                    <TableCell>{getKycBadge(profile.compliance_status)}</TableCell>
                    <TableCell>
                      {new Date(profile.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TooltipProvider>
                          {profile.compliance_status !== "cleared" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => openAction(profile, "cleared")}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  <span className="sr-only">Approve</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Approve clearance</TooltipContent>
                            </Tooltip>
                          )}
                          {profile.compliance_status !== "flagged" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  onClick={() => openAction(profile, "flagged")}
                                >
                                  <Flag className="h-4 w-4" />
                                  <span className="sr-only">Flag</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Flag for review</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                asChild
                              >
                                <Link href={`/compliance/${profile.id}`}>
                                  <ExternalLink className="h-4 w-4" />
                                  <span className="sr-only">Full review</span>
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Full review</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {profiles.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      {search
                        ? `No results for "${search}"`
                        : `No profiles with status "${statusFilter}".`}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <p className="text-sm text-muted-foreground">
            {data.total} profile{data.total !== 1 ? "s" : ""} in queue
          </p>
        )}
      </div>

      <QuickActionDialog
        profile={actionProfile}
        action={actionType}
        onClose={() => {
          setActionProfile(null);
          setActionType(null);
        }}
        onConfirm={(notes) => {
          if (actionProfile && actionType) {
            reviewMutation.mutate({
              id: actionProfile.id,
              status: actionType,
              notes,
            });
          }
        }}
        isPending={reviewMutation.isPending}
      />
    </div>
  );
}
