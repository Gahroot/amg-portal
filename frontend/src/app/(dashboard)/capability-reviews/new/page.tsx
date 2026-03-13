"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { createCapabilityReview } from "@/lib/api/capability-reviews";
import { listPartners } from "@/lib/api/partners";
import { listUsers } from "@/lib/api/users";
import type { CreateCapabilityReviewRequest } from "@/types/capability-review";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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

const ALLOWED_ROLES = [
  "managing_director",
  "relationship_manager",
  "coordinator",
  "finance_compliance",
];

export default function NewCapabilityReviewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [partnerId, setPartnerId] = React.useState("");
  const [reviewYear, setReviewYear] = React.useState(
    new Date().getFullYear()
  );
  const [reviewerId, setReviewerId] = React.useState("");
  const [scheduledDate, setScheduledDate] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const { data: partnersData } = useQuery({
    queryKey: ["partners-list"],
    queryFn: () => listPartners({ limit: 200 }),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const { data: usersData } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => listUsers({ limit: 200 }),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCapabilityReviewRequest) =>
      createCapabilityReview(data),
    onSuccess: (review) => {
      queryClient.invalidateQueries({ queryKey: ["capability-reviews"] });
      queryClient.invalidateQueries({
        queryKey: ["capability-review-statistics"],
      });
      router.push(`/capability-reviews/${review.id}`);
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

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + 1 - i);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerId) return;

    const data: CreateCapabilityReviewRequest = {
      partner_id: partnerId,
      review_year: reviewYear,
    };
    if (reviewerId) data.reviewer_id = reviewerId;
    if (scheduledDate) data.scheduled_date = scheduledDate;
    if (notes) data.notes = notes;

    createMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Button variant="ghost" onClick={() => router.back()}>
            ← Back
          </Button>
          <h1 className="font-serif text-3xl font-bold tracking-tight mt-2">
            New Capability Review
          </h1>
          <p className="text-muted-foreground mt-1">
            Create a new capability review for a partner.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Review Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-sm font-medium">
                  Partner <span className="text-red-500">*</span>
                </label>
                <Select value={partnerId} onValueChange={setPartnerId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a partner" />
                  </SelectTrigger>
                  <SelectContent>
                    {partnersData?.profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.firm_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Review Year <span className="text-red-500">*</span>
                </label>
                <Select
                  value={reviewYear.toString()}
                  onValueChange={(v) => setReviewYear(parseInt(v))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Reviewer</label>
                <Select value={reviewerId} onValueChange={setReviewerId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Assign a reviewer (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {usersData?.users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Scheduled Date</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  className="mt-1"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Optional notes for this review..."
                />
              </div>

              {createMutation.isError && (
                <p className="text-sm text-red-600">
                  Failed to create review. Please try again.
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={!partnerId || createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Review"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
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
