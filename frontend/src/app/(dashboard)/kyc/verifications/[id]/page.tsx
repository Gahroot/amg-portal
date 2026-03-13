"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { getKYCVerification } from "@/lib/api/kyc-verifications";
import { getClientProfile } from "@/lib/api/clients";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { VerificationStatusBadge } from "@/components/kyc/verification-status-badge";
import { DocumentTypeBadge } from "@/components/kyc/document-type-badge";
import { VerificationTimeline } from "@/components/kyc/verification-timeline";
import { VerifyActionDialog } from "@/components/kyc/verify-action-dialog";
import { Download, FileText, ArrowLeft } from "lucide-react";

const ALLOWED_ROLES = [
  "finance_compliance",
  "managing_director",
  "relationship_manager",
  "coordinator",
];

export default function VerificationDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const kycId = params.id as string;
  const clientId = searchParams.get("client_id") ?? "";
  const { user } = useAuth();

  const isAllowed = user && ALLOWED_ROLES.includes(user.role);
  const canVerify =
    user?.role === "finance_compliance" ||
    user?.role === "managing_director";

  const { data: verification, isLoading } = useQuery({
    queryKey: ["kyc-verification", kycId],
    queryFn: () => getKYCVerification(clientId, kycId),
    enabled: !!isAllowed && !!clientId,
  });

  const { data: client } = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => getClientProfile(clientId),
    enabled: !!isAllowed && !!clientId,
  });

  if (!isAllowed) {
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
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground text-sm">
            Loading verification...
          </p>
        </div>
      </div>
    );
  }

  if (!verification) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground">Verification not found.</p>
        </div>
      </div>
    );
  }

  const checks = [
    {
      name: "Document Authenticity",
      status: verification.status === "verified" ? "passed" : verification.status === "rejected" ? "failed" : "pending",
    },
    {
      name: "Expiry Validation",
      status: verification.expiry_date
        ? new Date(verification.expiry_date) > new Date()
          ? "passed"
          : "failed"
        : "not_applicable",
    },
    {
      name: "Client Identity Match",
      status: verification.status === "verified" ? "passed" : verification.status === "rejected" ? "failed" : "pending",
    },
    {
      name: "Document Completeness",
      status: verification.document ? "passed" : "pending",
    },
  ];

  const checkStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    passed: "default",
    failed: "destructive",
    pending: "outline",
    not_applicable: "secondary",
  };

  const checkStatusLabel: Record<string, string> = {
    passed: "Passed",
    failed: "Failed",
    pending: "Pending",
    not_applicable: "N/A",
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/kyc/verifications">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Verifications
            </Link>
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              Verification Detail
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              ID: {verification.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <VerificationStatusBadge status={verification.status} />
            {canVerify && verification.status === "pending" && (
              <>
                <VerifyActionDialog
                  clientId={clientId}
                  kycId={kycId}
                  action="verified"
                  trigger={<Button size="sm">Verify</Button>}
                />
                <VerifyActionDialog
                  clientId={clientId}
                  kycId={kycId}
                  action="rejected"
                  trigger={
                    <Button size="sm" variant="destructive">
                      Reject
                    </Button>
                  }
                />
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Client Information</CardTitle>
              </CardHeader>
              <CardContent>
                {client ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">
                        <Link
                          href={`/clients/${clientId}`}
                          className="hover:underline"
                        >
                          {client.display_name || client.legal_name}
                        </Link>
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Entity Type
                      </p>
                      <p className="font-medium">
                        {client.entity_type ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Jurisdiction
                      </p>
                      <p className="font-medium">
                        {client.jurisdiction ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Compliance Status
                      </p>
                      <Badge
                        variant={
                          client.compliance_status === "cleared"
                            ? "default"
                            : client.compliance_status === "flagged" ||
                                client.compliance_status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {client.compliance_status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Loading client information...
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Checks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Verification Checks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Check</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checks.map((check) => (
                      <TableRow key={check.name}>
                        <TableCell className="font-medium">
                          {check.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant={checkStatusVariant[check.status]}>
                            {checkStatusLabel[check.status]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Linked Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Linked Documents</CardTitle>
              </CardHeader>
              <CardContent>
                {verification.document ? (
                  <div className="flex items-center justify-between rounded-md border p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {verification.document.file_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(verification.document.file_size / 1024).toFixed(1)}{" "}
                          KB · {verification.document.content_type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DocumentTypeBadge type={verification.document_type} />
                      {verification.document.download_url && (
                        <Button asChild size="sm" variant="outline">
                          <a
                            href={verification.document.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="mr-1 h-3 w-3" />
                            Download
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No document linked to this verification.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Rejection Details */}
            {verification.rejection_reason && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-destructive">
                    Rejection Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{verification.rejection_reason}</p>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {verification.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{verification.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Timeline & Details */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <VerificationTimeline verification={verification} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Document Type</p>
                  <DocumentTypeBadge type={verification.document_type} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <VerificationStatusBadge status={verification.status} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expiry Date</p>
                  <p className="text-sm font-medium">
                    {verification.expiry_date
                      ? new Date(
                          verification.expiry_date,
                        ).toLocaleDateString()
                      : "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-sm font-medium">
                    {new Date(verification.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="text-sm font-medium">
                    {new Date(verification.updated_at).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
