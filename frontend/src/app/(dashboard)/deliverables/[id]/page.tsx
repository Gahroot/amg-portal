"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getDeliverable,
  reviewDeliverable,
} from "@/lib/api/deliverables";
import type { DeliverableReviewData } from "@/types/deliverable";
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
import { Download, FileText, Eye } from "lucide-react";

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

function getFileType(fileName: string | null): "pdf" | "image" | "other" {
  if (!fileName) return "other";
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  return "other";
}

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

  const [previewOpen, setPreviewOpen] = React.useState(false);

  const handleDownload = () => {
    if (!deliverable?.download_url) {
      toast.error("No file available to download");
      return;
    }
    window.open(deliverable.download_url, "_blank");
  };

  const fileType = getFileType(deliverable?.file_name ?? null);

  const canReview =
    deliverable &&
    (deliverable.status === "submitted" ||
      deliverable.status === "under_review");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
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
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground">Deliverable not found.</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-background p-8">
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
            {deliverable.download_url && (
              <>
                {fileType !== "other" && (
                  <Button
                    variant="outline"
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                )}
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </>
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
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="text-sm font-medium">{deliverable.file_name}</p>
                  </div>
                  {deliverable.file_size != null && (
                    <p className="text-xs text-muted-foreground pl-6">
                      {(deliverable.file_size / 1024).toFixed(1)} KB
                    </p>
                  )}
                  {deliverable.submitted_at && (
                    <p className="text-xs text-muted-foreground pl-6">
                      Submitted {new Date(deliverable.submitted_at).toLocaleString()}
                    </p>
                  )}
                </div>
                {deliverable.download_url && (
                  <div className="flex items-center gap-2 shrink-0">
                    {fileType !== "other" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewOpen(true)}
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        Preview
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownload}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                )}
              </div>

              {/* Inline preview for PDFs and images */}
              {deliverable.download_url && fileType === "image" && (
                <div className="rounded-md border overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={deliverable.download_url}
                    alt={deliverable.file_name ?? "Preview"}
                    className="max-h-96 w-full object-contain bg-muted"
                  />
                </div>
              )}
              {deliverable.download_url && fileType === "pdf" && (
                <div className="rounded-md border overflow-hidden">
                  <iframe
                    src={deliverable.download_url}
                    title={deliverable.file_name ?? "PDF Preview"}
                    className="h-[600px] w-full"
                  />
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

    {/* Preview Dialog */}
    {deliverable.download_url && fileType !== "other" && (
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {deliverable.file_name}
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-md border overflow-hidden">
            {fileType === "pdf" ? (
              <iframe
                src={deliverable.download_url}
                title={deliverable.file_name ?? "PDF Preview"}
                className="h-[70vh] w-full"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={deliverable.download_url}
                alt={deliverable.file_name ?? "Preview"}
                className="max-h-[70vh] w-full object-contain bg-muted"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}
