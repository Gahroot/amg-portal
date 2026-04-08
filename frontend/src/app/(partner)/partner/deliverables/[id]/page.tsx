"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  usePartnerDeliverable,
  useSubmitPartnerDeliverable,
} from "@/hooks/use-partner-portal";
import { getMyAssignment } from "@/lib/api/partner-portal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
} from "lucide-react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  submitted: "secondary",
  under_review: "secondary",
  approved: "default",
  returned: "destructive",
  rejected: "destructive",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; description: string }
> = {
  pending: {
    label: "Pending",
    icon: <Clock className="h-5 w-5" />,
    color: "text-muted-foreground",
    description: "Waiting for you to upload and submit this deliverable.",
  },
  submitted: {
    label: "Submitted",
    icon: <Upload className="h-5 w-5" />,
    color: "text-blue-600 dark:text-blue-400",
    description: "Your deliverable has been submitted and is awaiting review.",
  },
  under_review: {
    label: "Under Review",
    icon: <AlertCircle className="h-5 w-5" />,
    color: "text-yellow-600 dark:text-yellow-400",
    description: "Your deliverable is currently being reviewed by the coordinator.",
  },
  approved: {
    label: "Approved",
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: "text-green-600 dark:text-green-400",
    description: "Your deliverable has been approved. Great work!",
  },
  returned: {
    label: "Returned",
    icon: <XCircle className="h-5 w-5" />,
    color: "text-orange-600 dark:text-orange-400",
    description: "Your deliverable needs revisions. Please review the feedback and resubmit.",
  },
  rejected: {
    label: "Rejected",
    icon: <XCircle className="h-5 w-5" />,
    color: "text-destructive",
    description: "This deliverable was not accepted. Please contact your coordinator.",
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function PartnerDeliverableDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deliverableId = params.id as string;
  const [error, setError] = React.useState<string | null>(null);

  const { data: deliverable, isLoading } = usePartnerDeliverable(deliverableId);

  const { data: assignment } = useQuery({
    queryKey: ["partner-portal", "assignments", deliverable?.assignment_id],
    queryFn: () => getMyAssignment(deliverable!.assignment_id),
    enabled: !!deliverable?.assignment_id,
  });

  const submitMutation = useSubmitPartnerDeliverable();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      submitMutation.mutate(
        { id: deliverableId, file },
        {
          onError: () => setError("Failed to submit deliverable."),
        }
      );
    }
  };

  const handleDownload = () => {
    if (deliverable?.download_url) {
      window.open(deliverable.download_url, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-muted-foreground text-sm">Loading deliverable...</p>
      </div>
    );
  }

  if (!deliverable) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-muted-foreground">Deliverable not found.</p>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[deliverable.status] || STATUS_CONFIG.pending;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="mb-2" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Deliverables
          </Button>
          <h1 className="font-serif text-3xl font-bold tracking-tight">{deliverable.title}</h1>
          <div className="flex items-center gap-3">
            <Badge variant={STATUS_VARIANT[deliverable.status] ?? "outline"}>
              {statusConfig.label}
            </Badge>
            <Badge variant="outline">{deliverable.deliverable_type}</Badge>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Status Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className={`${statusConfig.color}`}>{statusConfig.icon}</div>
            <div className="flex-1">
              <h3 className="font-semibold">{statusConfig.label}</h3>
              <p className="text-sm text-muted-foreground">{statusConfig.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <p className="text-sm">Due Date</p>
            </div>
            <p className="font-medium">
              {deliverable.due_date ? new Date(deliverable.due_date).toLocaleDateString() : "Not set"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Upload className="h-4 w-4" />
              <p className="text-sm">Submitted</p>
            </div>
            <p className="font-medium">
              {deliverable.submitted_at
                ? new Date(deliverable.submitted_at).toLocaleDateString()
                : "Not yet submitted"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Assignment Link */}
      {assignment && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileText className="h-4 w-4" />
              <p className="text-sm">Part of Assignment</p>
            </div>
            <Link
              href={`/partner/inbox/${assignment.id}`}
              className="font-medium hover:underline text-primary"
            >
              {assignment.title}
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Description */}
      {deliverable.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{deliverable.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Submission Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Submission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(deliverable.status === "pending" || deliverable.status === "returned") && (
            <div className="space-y-3">
              <Label htmlFor="file-upload" className="text-sm font-medium">
                Upload your deliverable
              </Label>
              <Input
                id="file-upload"
                type="file"
                onChange={handleFileUpload}
                disabled={submitMutation.isPending}
              />
              {submitMutation.isPending && (
                <p className="text-sm text-muted-foreground">Uploading and submitting...</p>
              )}
            </div>
          )}

          {deliverable.file_name && (
            <div className="rounded-md border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{deliverable.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {deliverable.file_size ? formatBytes(deliverable.file_size) : ""}
                    </p>
                  </div>
                </div>
                {deliverable.download_url && (
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                )}
              </div>
            </div>
          )}

          {!deliverable.file_name && deliverable.status !== "pending" && deliverable.status !== "returned" && (
            <p className="text-sm text-muted-foreground">No file has been submitted yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Review Feedback */}
      {(deliverable.review_comments || deliverable.reviewed_at) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Review Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {deliverable.reviewed_at && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Reviewed on {new Date(deliverable.reviewed_at).toLocaleDateString()}
              </div>
            )}
            {deliverable.review_comments && (
              <div className="rounded-md bg-muted p-4">
                <p className="text-sm whitespace-pre-wrap">{deliverable.review_comments}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Created */}
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Deliverable Created</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(deliverable.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Submitted */}
            {deliverable.submitted_at && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Submitted</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(deliverable.submitted_at).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {/* Reviewed */}
            {deliverable.reviewed_at && (
              <div className="flex gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    deliverable.status === "approved"
                      ? "bg-green-100 dark:bg-green-900/30"
                      : deliverable.status === "returned"
                        ? "bg-orange-100 dark:bg-orange-900/30"
                        : "bg-red-100 dark:bg-red-900/30"
                  }`}
                >
                  {deliverable.status === "approved" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle
                      className={`h-4 w-4 ${
                        deliverable.status === "returned" ? "text-orange-600 dark:text-orange-400" : "text-red-600 dark:text-red-400"
                      }`}
                    />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {deliverable.status === "approved" ? "Approved" : "Returned for Revision"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(deliverable.reviewed_at).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
