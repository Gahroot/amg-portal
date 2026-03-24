"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getAccessAudit, createAuditFinding } from "@/lib/api/access-audits";
import { listUsers } from "@/lib/api/users";
import type {
  CreateAccessAuditFindingRequest,
  FindingType,
  FindingSeverity,
} from "@/types/access-audit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/providers/auth-provider";

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
  const router = useRouter();
  const params = useParams();
  const auditId = params.id as string;
  const { user } = useAuth();

  const [findingType, setFindingType] = React.useState<FindingType>("other");
  const [severity, setSeverity] = React.useState<FindingSeverity>("medium");
  const [userId, setUserId] = React.useState<string>("");
  const [description, setDescription] = React.useState("");
  const [recommendation, setRecommendation] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const { data: audit } = useQuery({
    queryKey: ["access-audit", auditId],
    queryFn: () => getAccessAudit(auditId),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const { data: usersData } = useQuery({
    queryKey: ["users", { limit: 200 }],
    queryFn: () => listUsers({ limit: 200 }),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateAccessAuditFindingRequest) =>
      createAuditFinding(auditId, data),
    onSuccess: () => {
      router.push(`/access-audits/${auditId}`);
    },
    onError: () => {
      setError("Failed to add finding. Please try again.");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!description.trim()) {
      setError("Description is required.");
      return;
    }

    createMutation.mutate({
      finding_type: findingType,
      severity,
      description: description.trim(),
      recommendation: recommendation.trim() || undefined,
      user_id: userId || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1"
            onClick={() => router.push(`/access-audits/${auditId}`)}
          >
            ← Back to Audit
          </Button>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Add Finding
          </h1>
          {audit && (
            <p className="mt-1 text-muted-foreground">
              {audit.audit_period} Access Audit
            </p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Finding Details</CardTitle>
            <CardDescription>
              Document a security finding discovered during this access audit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="finding-type">Finding Type *</Label>
                <Select
                  value={findingType}
                  onValueChange={(v) => setFindingType(v as FindingType)}
                >
                  <SelectTrigger id="finding-type">
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

              <div className="space-y-2">
                <Label htmlFor="severity">Severity *</Label>
                <Select
                  value={severity}
                  onValueChange={(v) => setSeverity(v as FindingSeverity)}
                >
                  <SelectTrigger id="severity">
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

              <div className="space-y-2">
                <Label htmlFor="user">Affected User</Label>
                <Select
                  value={userId}
                  onValueChange={setUserId}
                >
                  <SelectTrigger id="user">
                    <SelectValue placeholder="Select a user (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {usersData?.users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name} — {u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Optional. The user account this finding relates to.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the finding in detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recommendation">Recommendation</Label>
                <Textarea
                  id="recommendation"
                  placeholder="Recommended remediation steps..."
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !description.trim()}
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
