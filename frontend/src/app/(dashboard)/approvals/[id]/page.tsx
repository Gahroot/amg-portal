"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { useClientProfile, useMDApproval } from "@/hooks/use-clients";
import { listUsers } from "@/lib/api/users";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

export default function MDApprovalReviewPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user } = useAuth();
  const { data: profile, isLoading } = useClientProfile(id);
  const approvalMutation = useMDApproval(id);

  const { data: usersData } = useQuery({
    queryKey: ["users", { role: "relationship_manager" }],
    queryFn: () => listUsers({ role: "relationship_manager" }),
    enabled: user?.role === "managing_director",
  });

  const [approved, setApproved] = React.useState<string>("");
  const [assignedRmId, setAssignedRmId] = React.useState<string>("");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  if (user?.role !== "managing_director") {
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
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-muted-foreground">Profile not found.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!approved) {
      setError("Please select approve or reject.");
      return;
    }

    try {
      await approvalMutation.mutateAsync({
        approved: approved === "approve",
        notes: notes || undefined,
        assigned_rm_id: assignedRmId || undefined,
      });
      router.push("/approvals");
    } catch {
      setError("Failed to submit approval decision.");
    }
  };

  const profileFields = [
    { label: "Legal Name", value: profile.legal_name },
    { label: "Display Name", value: profile.display_name },
    { label: "Entity Type", value: profile.entity_type },
    { label: "Jurisdiction", value: profile.jurisdiction },
    { label: "Tax ID", value: profile.tax_id },
    { label: "Primary Email", value: profile.primary_email },
    { label: "Secondary Email", value: profile.secondary_email },
    { label: "Phone", value: profile.phone },
    { label: "Address", value: profile.address },
    { label: "Communication Preference", value: profile.communication_preference },
    { label: "Sensitivities", value: profile.sensitivities },
    { label: "Special Instructions", value: profile.special_instructions },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          MD Approval Review
        </h1>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">
              Client Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profileFields.map((field) => (
                <div key={field.label}>
                  <p className="text-sm font-medium text-muted-foreground">
                    {field.label}
                  </p>
                  <p className="text-sm">{field.value || "-"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">
              Compliance Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Compliance Status
                </p>
                <Badge variant="default">
                  {profile.compliance_status.replace(/_/g, " ")}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Notes
                </p>
                <p className="text-sm">{profile.compliance_notes || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Reviewed By
                </p>
                <p className="text-sm">
                  {profile.compliance_reviewed_by || "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">
              Approval Decision
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Decision</Label>
                <Select onValueChange={setApproved}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select decision" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approve">Approve</SelectItem>
                    <SelectItem value="reject">Reject</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assign Relationship Manager</Label>
                <Select onValueChange={setAssignedRmId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select RM" />
                  </SelectTrigger>
                  <SelectContent>
                    {usersData?.users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="approval-notes">Notes (optional)</Label>
                <Textarea
                  id="approval-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes..."
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={approvalMutation.isPending}
                >
                  {approvalMutation.isPending
                    ? "Submitting..."
                    : "Submit Decision"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/approvals")}
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
