"use client";

import * as React from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useKYCDocuments, useVerifyKYCDocument } from "@/hooks/use-kyc-documents";
import type { KYCDocumentStatus, KYCDocumentItem } from "@/types/document";

const STATUS_VARIANT: Record<
  KYCDocumentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  verified: "default",
  pending: "secondary",
  expired: "destructive",
  rejected: "destructive",
};

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function VerificationActions({
  doc,
  clientId,
}: {
  doc: KYCDocumentItem;
  clientId: string;
}) {
  const [verifyStatus, setVerifyStatus] = React.useState<
    "verified" | "rejected"
  >("verified");
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  const verifyMutation = useVerifyKYCDocument(clientId);

  function handleSubmit() {
    verifyMutation.mutate(
      {
        kycId: doc.id,
        data: {
          status: verifyStatus,
          rejection_reason:
            verifyStatus === "rejected" ? rejectionReason || undefined : undefined,
          notes: notes || undefined,
        },
      },
      {
        onSuccess: () => setSubmitted(true),
      },
    );
  }

  if (submitted) {
    return (
      <Alert>
        <AlertDescription>
          Document has been marked as{" "}
          <strong>{formatLabel(verifyStatus)}</strong>. Refresh to see the
          updated status.
        </AlertDescription>
      </Alert>
    );
  }

  if (doc.status !== "pending") {
    return (
      <Alert>
        <AlertDescription>
          This document has already been processed with status:{" "}
          <strong>{formatLabel(doc.status)}</strong>.
          {doc.rejection_reason && (
            <span className="block mt-1">
              Rejection reason: {doc.rejection_reason}
            </span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Decision</label>
        <Select
          value={verifyStatus}
          onValueChange={(v) =>
            setVerifyStatus(v as "verified" | "rejected")
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {verifyStatus === "rejected" && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Rejection Reason</label>
          <Textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Explain why this document is being rejected..."
            rows={3}
          />
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">Internal Notes (optional)</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any notes for the record..."
          rows={2}
        />
      </div>

      <div className="flex gap-3">
        <Button
          onClick={handleSubmit}
          disabled={
            verifyMutation.isPending ||
            (verifyStatus === "rejected" && !rejectionReason.trim())
          }
          variant={verifyStatus === "rejected" ? "destructive" : "default"}
        >
          {verifyMutation.isPending
            ? "Submitting..."
            : verifyStatus === "verified"
              ? "Verify Document"
              : "Reject Document"}
        </Button>
      </div>
    </div>
  );
}

export default function KYCVerificationDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const kycId = params.id as string;
  const clientId = searchParams.get("client") ?? "";

  const { data, isLoading } = useKYCDocuments(clientId);
  const doc = data?.kyc_documents.find((d) => d.id === kycId);

  if (!clientId) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-3xl">
          <Alert>
            <AlertDescription>
              No client ID provided. Please navigate here from the verifications
              list.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <p className="text-sm text-muted-foreground">Loading document...</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-3xl">
          <Alert>
            <AlertDescription>KYC document not found.</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="-ml-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {/* Title */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              {formatLabel(doc.document_type)}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              KYC Document · Submitted{" "}
              {new Date(doc.created_at).toLocaleDateString()}
            </p>
          </div>
          <Badge
            variant={
              STATUS_VARIANT[doc.status as KYCDocumentStatus] ?? "outline"
            }
            className="text-sm"
          >
            {formatLabel(doc.status)}
          </Badge>
        </div>

        {/* Document Info */}
        <Card>
          <CardHeader>
            <CardTitle>Document Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Document Type</p>
                <p className="font-medium">{formatLabel(doc.document_type)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge
                  variant={
                    STATUS_VARIANT[doc.status as KYCDocumentStatus] ?? "outline"
                  }
                >
                  {formatLabel(doc.status)}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Expiry Date</p>
                <p className="font-medium">
                  {doc.expiry_date
                    ? new Date(doc.expiry_date).toLocaleDateString()
                    : "No expiry"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Uploaded</p>
                <p className="font-medium">
                  {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
              {doc.verified_at && (
                <div>
                  <p className="text-muted-foreground">Verified At</p>
                  <p className="font-medium">
                    {new Date(doc.verified_at).toLocaleDateString()}
                  </p>
                </div>
              )}
              {doc.notes && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Notes</p>
                  <p className="font-medium">{doc.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* File Info */}
        {doc.document && (
          <Card>
            <CardHeader>
              <CardTitle>Uploaded File</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <FileText className="size-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {doc.document.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(doc.document.file_size)} ·{" "}
                      {doc.document.content_type}
                    </p>
                  </div>
                </div>
                {doc.document.download_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={doc.document.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                    >
                      <Download className="size-4" />
                      Download
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Verification Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Verification Action</CardTitle>
          </CardHeader>
          <CardContent>
            <VerificationActions doc={doc} clientId={clientId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
