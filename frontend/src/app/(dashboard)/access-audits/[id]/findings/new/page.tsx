"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { getAccessAudit, createAuditFinding } from "@/lib/api/access-audits";
import { listUsers } from "@/lib/api/users";
import type {
  CreateAccessAuditFindingRequest,
  FindingType,
  FindingSeverity,
} from "@/types/access-audit";
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

const ALLOWED_ROLES = ["finance_compliance", "managing_director"];

const FINDING_TYPES: { value: FindingType; label: string }[] = [
  { value: "excessive_access", label: "Excessive Access" },
  { value: "inactive_user", label: "Inactive User" },
  { value: "role_mismatch", label: "Role Mismatch" },
  { value: "expired_credentials", label: "Expired Credentials" },
  { value: "policy_violation", label: "Policy Violation" },
  { value: "unapproved_access", label: "Unapproved Access" },
  { value: "orphaned_account", label: "Orphaned Account" },
  { value: "other", label: "Other" },
];

const SEVERITIES: { value: FindingSeverity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export default function NewAuditFindingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const auditId = params.id as string;

  const [findingType, setFindingType] = React.useState<FindingType>("other");
  const [severity, setSeverity] = React.useState<FindingSeverity>("medium");
  const [userId, setUserId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [recommendation, setRecommendation] = React.useState("");

  const { data: audit, isLoading: auditLoading } = useQuery({
    queryKey: ["access-audit", auditId],
    queryFn: () => getAccessAudit(auditId),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const { data: usersData } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => listUsers({ limit: 200 }),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateAccessAuditFindingRequest) =>
      createAuditFinding(auditId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-audit", auditId] });
      queryClient.invalidateQueries({ queryKey: ["access-audits"] });
      router.push(`/access-audits/${auditId}`);
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

  if (auditLoading) {
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

  if (audit.status === "completed") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          Cannot add findings to a completed audit.
        </p>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    const data: CreateAccessAuditFindingRequest = {
      finding_type: findingType,
      severity,
      description: description.trim(),
    };
    if (userId) data.user_id = userId;
    if (recommendation.trim()) data.recommendation = recommendation.trim();

    createMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Button
            variant="ghost"
            onClick={() => router.push(`/access-audits/${auditId}`)}
          >
            ← Back to Audit
          </Button>
          <h1 className="font-serif text-3xl font-bold tracking-tight mt-2">
            Add Finding
          </h1>
          <p className="text-muted-foreground mt-1">
            {audit.audit_period} Access Audit
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Finding Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-sm font-medium">
                  Finding Type <span className="text-red-500">*</span>
                </label>
                <Select
                  value={findingType}
                  onValueChange={(v) => setFindingType(v as FindingType)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINDING_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Severity <span className="text-red-500">*</span>
                </label>
                <Select
                  value={severity}
                  onValueChange={(v) => setSeverity(v as FindingSeverity)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Affected User</label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a user (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {usersData?.users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Description <span className="text-red-500">*</span>
                </label>
                <Textarea
                  className="mt-1"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe the finding..."
                />
              </div>

              <div>
                <label className="text-sm font-medium">Recommendation</label>
                <Textarea
                  className="mt-1"
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  rows={3}
                  placeholder="Recommended remediation steps (optional)..."
                />
              </div>

              {createMutation.isError && (
                <p className="text-sm text-red-600">
                  Failed to add finding. Please try again.
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={!description.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? "Adding..." : "Add Finding"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/access-audits/${auditId}`)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
