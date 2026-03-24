"use client";

import * as React from "react";
import { Plus, Check, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type PartnerQualification,
  type ServiceCategory,
  type QualificationLevel,
  type ApprovalStatus,
  QUALIFICATION_LEVEL_LABELS,
  APPROVAL_STATUS_LABELS,
  APPROVAL_STATUS_COLORS,
} from "@/types/partner-capability";
import { toast } from "sonner";

interface QualificationCardProps {
  qualifications: PartnerQualification[];
  serviceCategories: ServiceCategory[];
  onSubmit?: (data: {
    category_id: string;
    qualification_level: QualificationLevel;
    notes?: string;
  }) => Promise<void>;
  onApprove?: (
    qualificationId: string,
    data: { status: ApprovalStatus; notes?: string }
  ) => Promise<void>;
  canEdit?: boolean;
  canApprove?: boolean;
}

export function QualificationCard({
  qualifications,
  serviceCategories,
  onSubmit,
  onApprove,
  canEdit = false,
  canApprove = false,
}: QualificationCardProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [approvingQualification, setApprovingQualification] =
    React.useState<PartnerQualification | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Form state
  const [formState, setFormState] = React.useState({
    category_id: "",
    qualification_level: "qualified" as QualificationLevel,
    notes: "",
  });

  // Approve dialog state
  const [approveState, setApproveState] = React.useState({
    status: "approved" as ApprovalStatus,
    notes: "",
  });

  const resetForm = () => {
    setFormState({
      category_id: "",
      qualification_level: "qualified",
      notes: "",
    });
  };

  // Get categories that haven't been requested yet
  const availableCategories = serviceCategories.filter(
    (cat) => !qualifications.some((q) => q.category_id === cat.id)
  );

  const handleSubmit = async () => {
    if (!onSubmit || !formState.category_id) return;

    setIsLoading(true);
    try {
      await onSubmit({
        category_id: formState.category_id,
        qualification_level: formState.qualification_level,
        notes: formState.notes.trim() || undefined,
      });
      resetForm();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Failed to submit qualification:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!onApprove || !approvingQualification) return;

    setIsLoading(true);
    try {
      await onApprove(approvingQualification.id, {
        status: approveState.status,
        notes: approveState.notes.trim() || undefined,
      });
      setApprovingQualification(null);
      setApproveState({ status: "approved", notes: "" });
    } catch {
      toast.error("Failed to approve qualification");
    } finally {
      setIsLoading(false);
    }
  };

  const openApproveDialog = (qualification: PartnerQualification) => {
    setApprovingQualification(qualification);
    setApproveState({ status: "approved", notes: "" });
  };

  const QualificationLevelBadge = ({ level }: { level: QualificationLevel }) => {
    const colors: Record<QualificationLevel, string> = {
      qualified: "bg-blue-100 text-blue-700",
      preferred: "bg-purple-100 text-purple-700",
      expert: "bg-green-100 text-green-700",
    };

    const dots = level === "qualified" ? 1 : level === "preferred" ? 2 : 3;

    return (
      <Badge className={colors[level]}>
        <div className="flex items-center gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                i < dots ? "bg-current" : "bg-white/50"
              }`}
            />
          ))}
        </div>
        <span className="ml-2 text-xs">{QUALIFICATION_LEVEL_LABELS[level]}</span>
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Service Qualifications</CardTitle>
        {canEdit && onSubmit && availableCategories.length > 0 && (
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Request Qualification
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {qualifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No service qualifications requested.</p>
            {canEdit && onSubmit && availableCategories.length > 0 && (
              <Button
                variant="link"
                className="mt-2"
                onClick={() => setIsAddDialogOpen(true)}
              >
                Request your first qualification
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {qualifications.map((qualification) => (
              <div
                key={qualification.id}
                className="flex items-center justify-between p-3 rounded-md border"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {qualification.category_name || "Unknown Category"}
                      </p>
                      <Badge className={APPROVAL_STATUS_COLORS[qualification.approval_status]}>
                        {APPROVAL_STATUS_LABELS[qualification.approval_status]}
                      </Badge>
                    </div>
                    <div className="mt-1">
                      <QualificationLevelBadge
                        level={qualification.qualification_level}
                      />
                    </div>
                    {qualification.notes && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {qualification.notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canApprove &&
                    onApprove &&
                    qualification.approval_status === "pending" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openApproveDialog(qualification)}
                          className="text-green-600"
                          title="Approve"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            openApproveDialog(qualification)
                          }
                          className="text-red-600"
                          title="Reject"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add Dialog */}
      <Dialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Service Qualification</DialogTitle>
            <DialogDescription>
              Request qualification for a service category.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category_id">Service Category *</Label>
              <Select
                value={formState.category_id}
                onValueChange={(value) =>
                  setFormState({ ...formState, category_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a service category" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qualification_level">Qualification Level *</Label>
              <Select
                value={formState.qualification_level}
                onValueChange={(value: QualificationLevel) =>
                  setFormState({ ...formState, qualification_level: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="preferred">Preferred</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formState.notes}
                onChange={(e) =>
                  setFormState({ ...formState, notes: e.target.value })
                }
                placeholder="Supporting information for this qualification request"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !formState.category_id}
            >
              {isLoading ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve/Reject Dialog */}
      <Dialog
        open={!!approvingQualification}
        onOpenChange={(open) => {
          if (!open) {
            setApprovingQualification(null);
            setApproveState({ status: "approved", notes: "" });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Qualification</DialogTitle>
            <DialogDescription>
              Approve or reject this qualification request.
            </DialogDescription>
          </DialogHeader>

          {approvingQualification && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-md">
                <p className="font-medium">
                  {approvingQualification.category_name}
                </p>
                <div className="mt-1">
                  <QualificationLevelBadge
                    level={approvingQualification.qualification_level}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="approve_status">Decision</Label>
                <Select
                  value={approveState.status}
                  onValueChange={(value: ApprovalStatus) =>
                    setApproveState({ ...approveState, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approve</SelectItem>
                    <SelectItem value="rejected">Reject</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="approve_notes">Notes</Label>
                <Textarea
                  id="approve_notes"
                  value={approveState.notes}
                  onChange={(e) =>
                    setApproveState({ ...approveState, notes: e.target.value })
                  }
                  placeholder="Add any notes about this decision"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setApprovingQualification(null);
                setApproveState({ status: "approved", notes: "" });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={isLoading}>
              {isLoading ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
