"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  getAccessAudit,
  createAuditFinding,
  updateAccessAudit,
  completeAccessAudit,
  remediateFinding,
  waiveFinding,
  acknowledgeFinding,
} from "@/lib/api/access-audits";
import type {
  CreateAccessAuditFindingRequest,
  UpdateAccessAuditRequest,
  FindingSeverity,
  FindingType,
} from "@/types/access-audit";
import { StatusBadge } from "@/components/ui/status-badge";
import { AuditFindingTable } from "@/components/access-audits/audit-finding-table";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const ALLOWED_ROLES = ["finance_compliance", "managing_director"];

const FINDING_TYPES: FindingType[] = [
  "excessive_access",
  "inactive_user",
  "role_mismatch",
  "expired_credentials",
  "policy_violation",
  "unapproved_access",
  "orphaned_account",
  "other",
];

const SEVERITIES: FindingSeverity[] = ["low", "medium", "high", "critical"];

export default function AccessAuditDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const auditId = params.id as string;

  const [showFindingDialog, setShowFindingDialog] = React.useState(false);
  const [showWaiveDialog, setShowWaiveDialog] = React.useState(false);
  const [selectedFindingId, setSelectedFindingId] = React.useState<string | null>(null);
  const [waiveReason, setWaiveReason] = React.useState("");
  const [newFinding, setNewFinding] = React.useState<CreateAccessAuditFindingRequest>({
    finding_type: "other",
    severity: "medium",
    description: "",
  });
  const [summary, setSummary] = React.useState("");
  const [recommendations, setRecommendations] = React.useState("");

  const { data: audit, isLoading } = useQuery({
    queryKey: ["access-audit", auditId],
    queryFn: () => getAccessAudit(auditId),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  React.useEffect(() => {
    if (audit) {
      setSummary(audit.summary || "");
      setRecommendations(audit.recommendations || "");
    }
  }, [audit]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateAccessAuditRequest) =>
      updateAccessAudit(auditId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-audit", auditId] });
      queryClient.invalidateQueries({ queryKey: ["access-audits"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => completeAccessAudit(auditId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-audit", auditId] });
      queryClient.invalidateQueries({ queryKey: ["access-audits"] });
    },
  });

  const createFindingMutation = useMutation({
    mutationFn: (data: CreateAccessAuditFindingRequest) =>
      createAuditFinding(auditId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-audit", auditId] });
      setShowFindingDialog(false);
      setNewFinding({
        finding_type: "other",
        severity: "medium",
        description: "",
      });
    },
  });

  const remediateMutation = useMutation({
    mutationFn: (findingId: string) =>
      remediateFinding(findingId, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-audit", auditId] });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (findingId: string) => acknowledgeFinding(findingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-audit", auditId] });
    },
  });

  const waiveMutation = useMutation({
    mutationFn: ({ findingId, reason }: { findingId: string; reason: string }) =>
      waiveFinding(findingId, { waived_reason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-audit", auditId] });
      setShowWaiveDialog(false);
      setSelectedFindingId(null);
      setWaiveReason("");
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

  if (!audit) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Audit not found.</p>
      </div>
    );
  }

  const handleSaveSummary = () => {
    updateMutation.mutate({ summary, recommendations });
  };

  const handleComplete = () => {
    completeMutation.mutate();
  };

  const handleCreateFinding = () => {
    createFindingMutation.mutate(newFinding);
  };

  const handleRemediate = (findingId: string) => {
    remediateMutation.mutate(findingId);
  };

  const handleAcknowledge = (findingId: string) => {
    acknowledgeMutation.mutate(findingId);
  };

  const handleWaive = () => {
    if (selectedFindingId && waiveReason) {
      waiveMutation.mutate({ findingId: selectedFindingId, reason: waiveReason });
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => router.back()}>
              ← Back
            </Button>
            <h1 className="font-serif text-3xl font-bold tracking-tight mt-2">
              {audit.audit_period} Access Audit
            </h1>
            <p className="text-muted-foreground mt-1">
              Auditor: {audit.auditor_name || "Unassigned"}
            </p>
          </div>
          <StatusBadge status={audit.status} className="text-lg" />
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-muted-foreground">Users Reviewed</p>
            <p className="text-2xl font-bold">{audit.users_reviewed}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-muted-foreground">Permissions Verified</p>
            <p className="text-2xl font-bold">{audit.permissions_verified}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-muted-foreground">Findings</p>
            <p className="text-2xl font-bold text-red-600">{audit.anomalies_found}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-muted-foreground">Open Findings</p>
            <p className="text-2xl font-bold text-yellow-600">
              {audit.findings.filter((f) =>
                ["open", "acknowledged", "in_progress"].includes(f.status)
              ).length}
            </p>
          </div>
        </div>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Summary</label>
              <Textarea
                className="mt-1"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                disabled={audit.status === "completed"}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Recommendations</label>
              <Textarea
                className="mt-1"
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                rows={3}
                disabled={audit.status === "completed"}
              />
            </div>
            {audit.status !== "completed" && (
              <Button
                onClick={handleSaveSummary}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save Summary"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Findings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Findings ({audit.findings.length})</CardTitle>
            {audit.status !== "completed" && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/access-audits/${auditId}/findings/new`)}
                >
                  Add Finding (Full Form)
                </Button>
                <Button onClick={() => setShowFindingDialog(true)}>
                  Quick Add
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <AuditFindingTable
              findings={audit.findings}
              isCompleted={audit.status === "completed"}
              onAcknowledge={handleAcknowledge}
              onRemediate={handleRemediate}
              onWaive={(findingId) => {
                setSelectedFindingId(findingId);
                setShowWaiveDialog(true);
              }}
            />
          </CardContent>
        </Card>

        {/* Complete Button */}
        {audit.status !== "completed" && (
          <div className="flex justify-end">
            <Button
              onClick={handleComplete}
              disabled={completeMutation.isPending}
              size="lg"
            >
              {completeMutation.isPending ? "Completing..." : "Complete Audit"}
            </Button>
          </div>
        )}
      </div>

      {/* Add Finding Dialog */}
      <Dialog open={showFindingDialog} onOpenChange={setShowFindingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Finding</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Finding Type</label>
              <Select
                value={newFinding.finding_type}
                onValueChange={(v) =>
                  setNewFinding((f) => ({ ...f, finding_type: v as FindingType }))
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINDING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Severity</label>
              <Select
                value={newFinding.severity}
                onValueChange={(v) =>
                  setNewFinding((f) => ({ ...f, severity: v as FindingSeverity }))
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                className="mt-2"
                value={newFinding.description}
                onChange={(e) =>
                  setNewFinding((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Recommendation (Optional)</label>
              <Textarea
                className="mt-2"
                value={newFinding.recommendation || ""}
                onChange={(e) =>
                  setNewFinding((f) => ({ ...f, recommendation: e.target.value }))
                }
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFindingDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFinding}
              disabled={createFindingMutation.isPending || !newFinding.description}
            >
              {createFindingMutation.isPending ? "Adding..." : "Add Finding"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Waive Dialog */}
      <Dialog open={showWaiveDialog} onOpenChange={setShowWaiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Waive Finding</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Reason for Waiver</label>
            <Textarea
              className="mt-2"
              value={waiveReason}
              onChange={(e) => setWaiveReason(e.target.value)}
              rows={3}
              placeholder="Provide a justification for waiving this finding..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWaiveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleWaive}
              disabled={waiveMutation.isPending || !waiveReason}
            >
              {waiveMutation.isPending ? "Waiving..." : "Waive Finding"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
