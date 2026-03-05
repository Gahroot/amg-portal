"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useClientProfile, useComplianceReview } from "@/hooks/use-clients";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

export default function ComplianceReviewPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user } = useAuth();
  const { data: profile, isLoading } = useClientProfile(id);
  const reviewMutation = useComplianceReview(id);

  const [status, setStatus] = React.useState<string>("");
  const [notes, setNotes] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(null);

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
    setValidationError(null);

    if (!status) {
      setValidationError("Please select a compliance status.");
      return;
    }
    if (!notes.trim()) {
      setValidationError("Notes are required.");
      return;
    }

    try {
      await reviewMutation.mutateAsync({
        status: status as "cleared" | "flagged" | "rejected",
        notes,
      });
      toast.success("Compliance review submitted");
      router.push("/compliance");
    } catch {
      // Error is handled by the hook's onError callback
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Compliance Review
        </h1>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">
              Profile Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Legal Name
                </p>
                <p className="text-sm">{profile.legal_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Entity Type
                </p>
                <p className="text-sm">{profile.entity_type || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Jurisdiction
                </p>
                <p className="text-sm">{profile.jurisdiction || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Primary Email
                </p>
                <p className="text-sm">{profile.primary_email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Tax ID
                </p>
                <p className="text-sm">{profile.tax_id || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Address
                </p>
                <p className="text-sm">{profile.address || "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">Review</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {validationError && (
                <p className="text-sm text-destructive">{validationError}</p>
              )}

              <div className="space-y-2">
                <Label>Status</Label>
                <Select onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cleared">Cleared</SelectItem>
                    <SelectItem value="flagged">Flagged</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes *</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Provide compliance review notes..."
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={reviewMutation.isPending}
                >
                  {reviewMutation.isPending ? "Submitting..." : "Submit Review"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/compliance")}
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
