"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useClientProfile, useComplianceReview } from "@/hooks/use-clients";
import { useKYCDocuments, useVerifyKYCDocument } from "@/hooks/use-kyc-documents";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentList } from "@/components/documents/document-list";
import { ArrowLeft, Download, CheckCircle, XCircle, Clock } from "lucide-react";

const ALLOWED_ROLES = ["finance_compliance", "managing_director"];

const KYC_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  verified: "default",
  rejected: "destructive",
  expired: "destructive",
};

const KYC_STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-amber-500" />,
  verified: <CheckCircle className="h-4 w-4 text-green-500" />,
  rejected: <XCircle className="h-4 w-4 text-red-500" />,
  expired: <XCircle className="h-4 w-4 text-red-500" />,
};

export default function ComplianceReviewPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user } = useAuth();
  const { data: profile, isLoading } = useClientProfile(id);
  const reviewMutation = useComplianceReview(id);
  const { data: kycData, isLoading: kycLoading } = useKYCDocuments(id);
  const verifyKycMutation = useVerifyKYCDocument(id);

  const [status, setStatus] = React.useState<string>("");
  const [notes, setNotes] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [verifyKycOpen, setVerifyKycOpen] = React.useState(false);
  const [selectedKyc, setSelectedKyc] = React.useState<string | null>(null);
  const [kycVerifyStatus, setKycVerifyStatus] = React.useState<"verified" | "rejected">("verified");
  const [kycNotes, setKycNotes] = React.useState("");

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

  const handleVerifyKyc = () => {
    if (!selectedKyc) return;
    verifyKycMutation.mutate(
      {
        kycId: selectedKyc,
        data: { status: kycVerifyStatus, notes: kycNotes || undefined },
      },
      {
        onSuccess: () => {
          toast.success("KYC document updated");
          setVerifyKycOpen(false);
          setSelectedKyc(null);
          setKycVerifyStatus("verified");
          setKycNotes("");
        },
      },
    );
  };

  const openVerifyDialog = (kycId: string) => {
    setSelectedKyc(kycId);
    setVerifyKycOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Compliance Review
          </h1>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="kyc">KYC Documents</TabsTrigger>
            <TabsTrigger value="documents">All Documents</TabsTrigger>
            <TabsTrigger value="review">Submit Review</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
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
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Compliance Status
                    </p>
                    <Badge variant={profile.compliance_status === "cleared" ? "default" : "secondary"}>
                      {profile.compliance_status || "pending_review"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Created
                    </p>
                    <p className="text-sm">
                      {new Date(profile.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kyc" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-xl">
                  KYC Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                {kycLoading ? (
                  <p className="text-muted-foreground text-sm">Loading KYC documents...</p>
                ) : kycData?.kyc_documents.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No KYC documents uploaded.</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Document Type</TableHead>
                          <TableHead>File Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Expiry</TableHead>
                          <TableHead>Uploaded</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {kycData?.kyc_documents.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell className="font-medium">
                              {doc.document_type}
                            </TableCell>
                            <TableCell>{doc.document?.file_name ?? "N/A"}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {KYC_STATUS_ICON[doc.status]}
                                <Badge variant={KYC_STATUS_VARIANT[doc.status]}>
                                  {doc.status}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              {doc.expiry_date
                                ? new Date(doc.expiry_date).toLocaleDateString()
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {new Date(doc.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {doc.document?.download_url && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(doc.document!.download_url!, "_blank")}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                                {doc.status === "pending" && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => openVerifyDialog(doc.id)}
                                  >
                                    Verify
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-xl">
                  All Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentList
                  entityType="client"
                  entityId={id}
                  showUpload={false}
                  showDelete={false}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="review" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-xl">Submit Review</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {validationError && (
                    <p className="text-sm text-destructive">{validationError}</p>
                  )}

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select onValueChange={setStatus} value={status}>
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
                      rows={5}
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
          </TabsContent>
        </Tabs>

        {/* KYC Verify Dialog */}
        <Dialog open={verifyKycOpen} onOpenChange={setVerifyKycOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify KYC Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Verification Status</Label>
                <Select
                  value={kycVerifyStatus}
                  onValueChange={(v) => setKycVerifyStatus(v as "verified" | "rejected")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={kycNotes}
                  onChange={(e) => setKycNotes(e.target.value)}
                  placeholder="Add any verification notes..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVerifyKycOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleVerifyKyc}
                disabled={verifyKycMutation.isPending}
              >
                {verifyKycMutation.isPending ? "Updating..." : "Update Status"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
