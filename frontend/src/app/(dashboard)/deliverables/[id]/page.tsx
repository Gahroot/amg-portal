"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getDeliverable,
  reviewDeliverable,
  getDownloadUrl,
} from "@/lib/api/deliverables";
import type { DeliverableReviewData } from "@/lib/api/deliverables";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  submitted: "secondary",
  under_review: "secondary",
  approved: "default",
  returned: "destructive",
  rejected: "destructive",
};

export default function DeliverableDetailPage() {
  const params = useParams();
  const deliverableId = params.id as string;
  const queryClient = useQueryClient();

  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [reviewData, setReviewData] = React.useState<DeliverableReviewData>({
    status: "approved",
    review_comments: "",
  });

  const { data: deliverable, isLoading } = useQuery({
    queryKey: ["deliverables", deliverableId],
    queryFn: () => getDeliverable(deliverableId),
  });

  const reviewMutation = useMutation({
    mutationFn: (data: DeliverableReviewData) =>
      reviewDeliverable(deliverableId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["deliverables", deliverableId],
      });
      setReviewOpen(false);
      setReviewData({ status: "approved", review_comments: "" });
      toast.success("Review submitted successfully");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to submit review"),
  });

  const handleDownload = async () => {
    try {
      const { download_url } = await getDownloadUrl(deliverableId);
      window.open(download_url, "_blank");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to get download URL";
      toast.error(message);
    }
  };

  const canReview =
    deliverable &&
    (deliverable.status === "submitted" ||
      deliverable.status === "under_review");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground text-sm">
            Loading deliverable...
          </p>
        </div>
      </div>
    );
  }

  if (!deliverable) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground">Deliverable not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            {deliverable.title}
          </h1>
          <div className="flex items-center gap-2">
            <Badge
              variant={STATUS_VARIANT[deliverable.status] ?? "outline"}
            >
              {deliverable.status.replace(/_/g, " ")}
            </Badge>
            {deliverable.file_path && (
              <Button variant="outline" onClick={handleDownload}>
                Download
              </Button>
            )}
            {canReview && (
              <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                <DialogTrigger asChild>
                  <Button>Review</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Review Deliverable</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Decision</Label>
                      <Select
                        value={reviewData.status}
                        onValueChange={(value) =>
                          setReviewData((prev) => ({
                            ...prev,
                            status: value as DeliverableReviewData["status"],
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approved">Approve</SelectItem>
                          <SelectItem value="returned">
                            Return with Comments
                          </SelectItem>
                          <SelectItem value="rejected">Reject</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Comments</Label>
                      <Textarea
                        value={reviewData.review_comments ?? ""}
                        onChange={(e) =>
                          setReviewData((prev) => ({
                            ...prev,
                            review_comments: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => reviewMutation.mutate(reviewData)}
                      disabled={reviewMutation.isPending}
                    >
                      {reviewMutation.isPending ? "Submitting..." : "Submit"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Type</p>
              <Badge variant="secondary">
                {deliverable.deliverable_type}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge
                variant={STATUS_VARIANT[deliverable.status] ?? "outline"}
              >
                {deliverable.status.replace(/_/g, " ")}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="font-medium">
                {deliverable.due_date
                  ? new Date(deliverable.due_date).toLocaleDateString()
                  : "Not set"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Client Visible</p>
              <p className="font-medium">
                {deliverable.client_visible ? "Yes" : "No"}
              </p>
            </CardContent>
          </Card>
        </div>

        {deliverable.description && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="text-sm mt-1 whitespace-pre-wrap">
                {deliverable.description}
              </p>
            </CardContent>
          </Card>
        )}

        {deliverable.file_name && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">
                Submitted File
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">File Name</p>
                <p className="text-sm">{deliverable.file_name}</p>
              </div>
              {deliverable.file_size != null && (
                <div>
                  <p className="text-sm text-muted-foreground">File Size</p>
                  <p className="text-sm">
                    {(deliverable.file_size / 1024).toFixed(1)} KB
                  </p>
                </div>
              )}
              {deliverable.submitted_at && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Submitted At
                  </p>
                  <p className="text-sm">
                    {new Date(deliverable.submitted_at).toLocaleString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {deliverable.reviewed_at && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">
                Review Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Reviewed At</p>
                <p className="text-sm">
                  {new Date(deliverable.reviewed_at).toLocaleString()}
                </p>
              </div>
              {deliverable.review_comments && (
                <div>
                  <p className="text-sm text-muted-foreground">Comments</p>
                  <p className="text-sm whitespace-pre-wrap">
                    {deliverable.review_comments}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
