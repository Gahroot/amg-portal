"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { downloadCertificatePDF } from "@/lib/api/clearance-certificates";
import {
  useCertificate,
  useIssueCertificate,
  useRevokeCertificate,
  useDeleteCertificate,
} from "@/hooks/use-certificates";
import { toast } from "sonner";

const ALLOWED_ROLES = ["finance_compliance", "managing_director", "relationship_manager", "coordinator"];

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  issued: "bg-green-100 text-green-800",
  revoked: "bg-red-100 text-red-800",
  expired: "bg-yellow-100 text-yellow-800",
};

export default function CertificateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [revokeReason, setRevokeReason] = React.useState("");
  const [issueNotes, setIssueNotes] = React.useState("");

  const certificateId = params.id as string;

  const { data: certificate, isLoading } = useCertificate(certificateId);
  const issueMutation = useIssueCertificate();
  const revokeMutation = useRevokeCertificate();
  const deleteMutation = useDeleteCertificate();

  const handleIssue = async () => {
    if (!certificate) return;
    issueMutation.mutate(
      { id: certificate.id, data: { review_notes: issueNotes || undefined } },
      {
        onSuccess: () => {
          setIssueNotes("");
        },
      }
    );
  };

  const handleRevoke = async () => {
    if (!certificate || !revokeReason.trim()) return;
    revokeMutation.mutate(
      { id: certificate.id, data: { reason: revokeReason } },
      {
        onSuccess: () => {
          setRevokeReason("");
        },
      }
    );
  };

  const handleDelete = async () => {
    if (!certificate) return;
    deleteMutation.mutate(certificate.id, {
      onSuccess: () => {
        router.push("/certificates");
      },
    });
  };

  const handleDownload = async () => {
    if (!certificate) return;
    try {
      await downloadCertificatePDF(certificate.id, certificate.certificate_number);
    } catch {
      toast.error("Failed to download certificate PDF");
    }
  };

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
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (!certificate) {
    return <p className="text-muted-foreground">Certificate not found.</p>;
  }

  const canEdit = (user.role === "finance_compliance" || user.role === "managing_director") && certificate.status === "draft";
  const canIssue = (user.role === "finance_compliance" || user.role === "managing_director") && certificate.status === "draft";
  const canRevoke = (user.role === "finance_compliance" || user.role === "managing_director") && certificate.status === "issued";
  const canDelete = (user.role === "finance_compliance" || user.role === "managing_director") && certificate.status === "draft";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              {certificate.title}
            </h1>
            <Badge className={statusColors[certificate.status]}>
              {certificate.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            {certificate.certificate_number}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/certificates">Back to List</Link>
          </Button>
          {certificate.status === "issued" && (
            <Button onClick={handleDownload}>Download PDF</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Certificate Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: certificate.content }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Client</p>
                <p className="font-medium">{certificate.client_name}</p>
              </div>
              {certificate.program_title && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Program</p>
                  <p className="font-medium">{certificate.program_title}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">Type</p>
                <p className="capitalize">
                  {certificate.certificate_type.replace(/_/g, " ")}
                </p>
              </div>
              {certificate.template_name && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Template</p>
                  <p>{certificate.template_name}</p>
                </div>
              )}
              {certificate.issue_date && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Issue Date</p>
                  <p>{new Date(certificate.issue_date).toLocaleDateString()}</p>
                </div>
              )}
              {certificate.expiry_date && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Expiry Date</p>
                  <p>{new Date(certificate.expiry_date).toLocaleDateString()}</p>
                </div>
              )}
              {certificate.reviewed_by_name && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reviewed By</p>
                  <p>{certificate.reviewed_by_name}</p>
                </div>
              )}
              {certificate.review_notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Review Notes</p>
                  <p className="text-sm">{certificate.review_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          {(canEdit || canIssue || canRevoke || canDelete) && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {canEdit && (
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/certificates/${certificate.id}/edit`}>
                      Edit Certificate
                    </Link>
                  </Button>
                )}

                {canIssue && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full">Issue Certificate</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Issue Certificate</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will finalize and issue the certificate. Once issued, it cannot be edited.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="py-4">
                        <Label htmlFor="issue-notes">Review Notes (optional)</Label>
                        <Textarea
                          id="issue-notes"
                          value={issueNotes}
                          onChange={(e) => setIssueNotes(e.target.value)}
                          placeholder="Add any review notes..."
                          className="mt-2"
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleIssue}>
                          Issue Certificate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {canRevoke && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full">
                        Revoke Certificate
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke Certificate</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will revoke the certificate. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="py-4">
                        <Label htmlFor="revoke-reason">Reason *</Label>
                        <Textarea
                          id="revoke-reason"
                          value={revokeReason}
                          onChange={(e) => setRevokeReason(e.target.value)}
                          placeholder="Enter reason for revocation..."
                          className="mt-2"
                          required
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleRevoke}
                          disabled={!revokeReason.trim()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Revoke Certificate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {canDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" className="w-full text-destructive">
                        Delete Draft
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Draft</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this draft certificate. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>
          )}

          {/* History */}
          {certificate.history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {certificate.history.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 text-sm">
                      <div className="flex-1">
                        <p className="font-medium capitalize">{entry.action}</p>
                        <p className="text-muted-foreground">
                          by {entry.actor_name} • {new Date(entry.created_at).toLocaleString()}
                        </p>
                        {entry.notes && (
                          <p className="text-muted-foreground mt-1">{entry.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
