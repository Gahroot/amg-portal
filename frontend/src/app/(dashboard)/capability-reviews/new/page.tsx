"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listPartners } from "@/lib/api/partners";
import { createCapabilityReview } from "@/lib/api/capability-reviews";
import type { CreateCapabilityReviewRequest } from "@/types/capability-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear + 1 - i);

export default function NewCapabilityReviewPage() {
  const router = useRouter();

  const [partnerId, setPartnerId] = useState("");
  const [reviewYear, setReviewYear] = useState(currentYear);
  const [scheduledDate, setScheduledDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: partnersData, isLoading: partnersLoading } = useQuery({
    queryKey: ["partners", { limit: 200 }],
    queryFn: () => listPartners({ limit: 200 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCapabilityReviewRequest) =>
      createCapabilityReview(data),
    onSuccess: (review) => {
      router.push(`/capability-reviews/${review.id}`);
    },
    onError: () => {
      setError("Failed to create capability review. Please try again.");
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!partnerId) {
      setError("Please select a partner.");
      return;
    }

    createMutation.mutate({
      partner_id: partnerId,
      review_year: reviewYear,
      scheduled_date: scheduledDate || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1"
            onClick={() => router.push("/capability-reviews")}
          >
            ← Back to Reviews
          </Button>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            New Capability Review
          </h1>
          <p className="mt-1 text-muted-foreground">
            Schedule a capability review for a partner.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Review Details</CardTitle>
            <CardDescription>
              Select the partner and review year to create the capability review.
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
                <Label htmlFor="partner">Partner *</Label>
                <Select
                  value={partnerId}
                  onValueChange={setPartnerId}
                  disabled={partnersLoading}
                >
                  <SelectTrigger id="partner">
                    <SelectValue
                      placeholder={
                        partnersLoading ? "Loading partners..." : "Select a partner"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {partnersData?.profiles.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        {partner.firm_name}
                        {partner.contact_name
                          ? ` — ${partner.contact_name}`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-year">Review Year *</Label>
                <Select
                  value={reviewYear.toString()}
                  onValueChange={(v) => setReviewYear(parseInt(v))}
                >
                  <SelectTrigger id="review-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled-date">Scheduled Date</Label>
                <Input
                  id="scheduled-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Optional. When the review is planned to take place.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any initial notes or context for this review..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !partnerId}
                >
                  {createMutation.isPending
                    ? "Creating..."
                    : "Create Review"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/capability-reviews")}
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
