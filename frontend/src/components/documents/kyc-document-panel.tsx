"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUploadZone } from "@/components/documents/file-upload-zone";
import {
  useKYCDocuments,
  useUploadKYCDocument,
  useVerifyKYCDocument,
} from "@/hooks/use-kyc-documents";
import type { KYCDocumentType, KYCDocumentItem } from "@/types/document";

const KYC_TYPES: KYCDocumentType[] = [
  "passport",
  "national_id",
  "proof_of_address",
  "tax_id",
  "bank_statement",
  "source_of_wealth",
  "other",
];

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "verified") return "default";
  if (status === "pending") return "secondary";
  return "destructive";
}

function isExpiringSoon(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  const diff = new Date(expiryDate).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

interface KYCDocumentPanelProps {
  clientId: string;
  canVerify?: boolean;
}

export function KYCDocumentPanel({ clientId, canVerify = false }: KYCDocumentPanelProps) {
  const { data, isLoading } = useKYCDocuments(clientId);
  const uploadMutation = useUploadKYCDocument(clientId);
  const verifyMutation = useVerifyKYCDocument(clientId);

  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [docType, setDocType] = React.useState<string>("passport");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [verifyDoc, setVerifyDoc] = React.useState<KYCDocumentItem | null>(null);
  const [verifyStatus, setVerifyStatus] = React.useState<"verified" | "rejected">("verified");
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [verifyNotes, setVerifyNotes] = React.useState("");

  function handleUpload() {
    if (!file) return;
    uploadMutation.mutate(
      {
        file,
        documentType: docType,
        expiryDate: expiryDate || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          setUploadOpen(false);
          setFile(null);
          setDocType("passport");
          setExpiryDate("");
          setNotes("");
        },
      },
    );
  }

  function handleVerify() {
    if (!verifyDoc) return;
    verifyMutation.mutate(
      {
        kycId: verifyDoc.id,
        data: {
          status: verifyStatus,
          rejection_reason: verifyStatus === "rejected" ? rejectionReason || undefined : undefined,
          notes: verifyNotes || undefined,
        },
      },
      {
        onSuccess: () => {
          setVerifyDoc(null);
          setVerifyStatus("verified");
          setRejectionReason("");
          setVerifyNotes("");
        },
      },
    );
  }

  if (isLoading) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">Loading KYC documents...</p>
    );
  }

  const kycDocs = data?.kyc_documents ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Plus className="size-4" />
          Upload KYC Document
        </Button>
      </div>

      {kycDocs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No KYC documents yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Verified By</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kycDocs.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <Badge variant="outline">{formatLabel(doc.document_type)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(doc.status)}>{formatLabel(doc.status)}</Badge>
                </TableCell>
                <TableCell>
                  {doc.expiry_date ? (
                    <span className={isExpiringSoon(doc.expiry_date) ? "text-destructive font-medium" : ""}>
                      {new Date(doc.expiry_date).toLocaleDateString()}
                      {isExpiringSoon(doc.expiry_date) && " (expiring soon)"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  )}
                </TableCell>
                <TableCell>{doc.verified_by ?? <span className="text-muted-foreground">-</span>}</TableCell>
                <TableCell>
                  {canVerify && doc.status === "pending" && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setVerifyDoc(doc)}
                    >
                      Verify
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload KYC Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FileUploadZone
              onFileSelect={setFile}
              isUploading={uploadMutation.isPending}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium">Document Type</label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KYC_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {formatLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Expiry Date</label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Dialog */}
      <Dialog open={!!verifyDoc} onOpenChange={(open) => !open && setVerifyDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify KYC Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={verifyStatus} onValueChange={(v) => setVerifyStatus(v as "verified" | "rejected")}>
                <SelectTrigger className="w-full">
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
                  placeholder="Reason for rejection"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDoc(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleVerify}
              disabled={verifyMutation.isPending}
            >
              {verifyMutation.isPending ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
