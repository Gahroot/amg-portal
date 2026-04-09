"use client";

import { useRef, useState } from "react";
import { Plus, Pencil, Upload, AlertTriangle, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  type PartnerCertification,
  type CertificationStatus,
  CERTIFICATION_STATUS_LABELS,
  CERTIFICATION_STATUS_COLORS,
} from "@/types/partner-capability";

interface CertificationListProps {
  certifications: PartnerCertification[];
  onAdd?: (data: {
    name: string;
    issuing_body: string;
    certificate_number?: string;
    issue_date?: string;
    expiry_date?: string;
    notes?: string;
  }) => Promise<PartnerCertification>;
  onUpdate?: (
    certificationId: string,
    data: {
      name?: string;
      issuing_body?: string;
      certificate_number?: string;
      issue_date?: string;
      expiry_date?: string;
      notes?: string;
    }
  ) => Promise<void>;
  onUploadDocument?: (certificationId: string, file: File) => Promise<void>;
  onVerify?: (
    certificationId: string,
    data: { status: CertificationStatus; notes?: string }
  ) => Promise<void>;
  canEdit?: boolean;
  canVerify?: boolean;
}

export function CertificationList({
  certifications,
  onAdd,
  onUpdate,
  onUploadDocument,
  onVerify,
  canEdit = false,
  canVerify = false,
}: CertificationListProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCertification, setEditingCertification] =
    useState<PartnerCertification | null>(null);
  const [verifyingCertification, setVerifyingCertification] =
    useState<PartnerCertification | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  // Form state
  const [formState, setFormState] = useState({
    name: "",
    issuing_body: "",
    certificate_number: "",
    issue_date: "",
    expiry_date: "",
    notes: "",
  });

  // Verify dialog state
  const [verifyState, setVerifyState] = useState({
    status: "verified" as CertificationStatus,
    notes: "",
  });

  const resetForm = () => {
    setFormState({
      name: "",
      issuing_body: "",
      certificate_number: "",
      issue_date: "",
      expiry_date: "",
      notes: "",
    });
  };

  const handleAdd = async () => {
    if (!onAdd || !formState.name.trim() || !formState.issuing_body.trim()) return;

    setIsLoading(true);
    try {
      await onAdd({
        name: formState.name.trim(),
        issuing_body: formState.issuing_body.trim(),
        certificate_number: formState.certificate_number.trim() || undefined,
        issue_date: formState.issue_date || undefined,
        expiry_date: formState.expiry_date || undefined,
        notes: formState.notes.trim() || undefined,
      });
      resetForm();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Failed to add certification:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (
      !onUpdate ||
      !editingCertification ||
      !formState.name.trim() ||
      !formState.issuing_body.trim()
    )
      return;

    setIsLoading(true);
    try {
      await onUpdate(editingCertification.id, {
        name: formState.name.trim(),
        issuing_body: formState.issuing_body.trim(),
        certificate_number: formState.certificate_number.trim() || undefined,
        issue_date: formState.issue_date || undefined,
        expiry_date: formState.expiry_date || undefined,
        notes: formState.notes.trim() || undefined,
      });
      setEditingCertification(null);
      resetForm();
    } catch {
      toast.error("Failed to update certification");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!onVerify || !verifyingCertification) return;

    setIsLoading(true);
    try {
      await onVerify(verifyingCertification.id, {
        status: verifyState.status,
        notes: verifyState.notes.trim() || undefined,
      });
      setVerifyingCertification(null);
      setVerifyState({ status: "verified", notes: "" });
    } catch (error) {
      console.error("Failed to verify certification:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (certificationId: string, file: File) => {
    if (!onUploadDocument) return;

    setUploadingId(certificationId);
    try {
      await onUploadDocument(certificationId, file);
    } catch {
      toast.error("Failed to upload document");
    } finally {
      setUploadingId(null);
    }
  };

  const openEditDialog = (certification: PartnerCertification) => {
    setEditingCertification(certification);
    setFormState({
      name: certification.name,
      issuing_body: certification.issuing_body,
      certificate_number: certification.certificate_number || "",
      issue_date: certification.issue_date || "",
      expiry_date: certification.expiry_date || "",
      notes: certification.notes || "",
    });
  };

  const openVerifyDialog = (certification: PartnerCertification) => {
    setVerifyingCertification(certification);
    setVerifyState({ status: "verified", notes: "" });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Certifications</CardTitle>
        {canEdit && onAdd && (
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Certification
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {certifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No certifications added yet.</p>
            {canEdit && onAdd && (
              <Button
                variant="link"
                className="mt-2"
                onClick={() => setIsAddDialogOpen(true)}
              >
                Add your first certification
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {certifications.map((certification) => (
              <div
                key={certification.id}
                className="flex items-center justify-between p-3 rounded-md border"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{certification.name}</p>
                      <Badge className={CERTIFICATION_STATUS_COLORS[certification.verification_status]}>
                        {CERTIFICATION_STATUS_LABELS[certification.verification_status]}
                      </Badge>
                      {certification.is_expired && (
                        <Badge variant="destructive">Expired</Badge>
                      )}
                      {certification.is_expiring_soon && !certification.is_expired && (
                        <Badge
                          variant="outline"
                          className="bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800"
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Expiring Soon
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{certification.issuing_body}</span>
                      {certification.certificate_number && (
                        <span>• #{certification.certificate_number}</span>
                      )}
                      {certification.expiry_date && (
                        <span>
                          • Expires: {new Date(certification.expiry_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canEdit && onUploadDocument && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && uploadTargetId) {
                            handleFileUpload(uploadTargetId, file);
                            setUploadTargetId(null);
                          }
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setUploadTargetId(certification.id);
                          fileInputRef.current?.click();
                        }}
                        disabled={uploadingId === certification.id}
                        title="Upload document"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {canVerify &&
                    onVerify &&
                    certification.verification_status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openVerifyDialog(certification)}
                        className="text-green-600 dark:text-green-400"
                        title="Verify certification"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  {canEdit && onUpdate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(certification)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog
        open={isAddDialogOpen || !!editingCertification}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingCertification(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCertification ? "Edit Certification" : "Add Certification"}
            </DialogTitle>
            <DialogDescription>
              {editingCertification
                ? "Update the certification details below."
                : "Add a professional certification to the partner's profile."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Certification Name *</Label>
              <Input
                id="name"
                value={formState.name}
                onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                placeholder="e.g., CFA, CPA, CFP"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="issuing_body">Issuing Body *</Label>
              <Input
                id="issuing_body"
                value={formState.issuing_body}
                onChange={(e) =>
                  setFormState({ ...formState, issuing_body: e.target.value })
                }
                placeholder="e.g., CFA Institute, AICPA"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="certificate_number">Certificate Number</Label>
              <Input
                id="certificate_number"
                value={formState.certificate_number}
                onChange={(e) =>
                  setFormState({ ...formState, certificate_number: e.target.value })
                }
                placeholder="e.g., 123456"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="issue_date">Issue Date</Label>
                <Input
                  id="issue_date"
                  type="date"
                  value={formState.issue_date}
                  onChange={(e) =>
                    setFormState({ ...formState, issue_date: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry_date">Expiry Date</Label>
                <Input
                  id="expiry_date"
                  type="date"
                  value={formState.expiry_date}
                  onChange={(e) =>
                    setFormState({ ...formState, expiry_date: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formState.notes}
                onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                placeholder="Additional notes about this certification"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setEditingCertification(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingCertification ? handleUpdate : handleAdd}
              disabled={
                isLoading || !formState.name.trim() || !formState.issuing_body.trim()
              }
            >
              {isLoading
                ? "Saving..."
                : editingCertification
                  ? "Update"
                  : "Add Certification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Dialog */}
      <Dialog
        open={!!verifyingCertification}
        onOpenChange={(open) => {
          if (!open) {
            setVerifyingCertification(null);
            setVerifyState({ status: "verified", notes: "" });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Certification</DialogTitle>
            <DialogDescription>
              Review and verify or reject this certification.
            </DialogDescription>
          </DialogHeader>

          {verifyingCertification && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-md">
                <p className="font-medium">{verifyingCertification.name}</p>
                <p className="text-sm text-muted-foreground">
                  {verifyingCertification.issuing_body}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verify_status">Verification Status</Label>
                <Select
                  value={verifyState.status}
                  onValueChange={(value: CertificationStatus) =>
                    setVerifyState({ ...verifyState, status: value })
                  }
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
                <Label htmlFor="verify_notes">Notes</Label>
                <Textarea
                  id="verify_notes"
                  value={verifyState.notes}
                  onChange={(e) =>
                    setVerifyState({ ...verifyState, notes: e.target.value })
                  }
                  placeholder="Add any notes about this verification"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVerifyingCertification(null);
                setVerifyState({ status: "verified", notes: "" });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleVerify} disabled={isLoading}>
              {isLoading ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
