"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPartner,
  getPartnerTrends,
  updatePartner,
  provisionPartner,
  uploadComplianceDoc,
} from "@/lib/api/partners";
import type { PartnerUpdateData } from "@/types/partner";
import { PerformanceChart } from "@/components/partners/performance-chart";
import { listAssignments } from "@/lib/api/assignments";
import {
  listPartnerNotices,
  type PerformanceNotice,
} from "@/lib/api/performance-notices";
import { useAuth } from "@/providers/auth-provider";
import { PerformanceNoticeDialog } from "@/components/partners/performance-notice-dialog";
import { PartnerScoreCard } from "@/components/partners/partner-score-card";
import { GovernanceActionForm } from "@/components/partners/governance-action-form";
import {
  getCompositeScore,
  getGovernanceHistory,
} from "@/lib/api/partner-governance";
import type { GovernanceAction as GovernanceActionType } from "@/types/partner-governance";
import {
  getCapabilityMatrix,
  addPartnerCapability,
  updatePartnerCapability,
  deletePartnerCapability,
  verifyPartnerCapability,
  addPartnerCertification,
  uploadCertificationDocument,
  verifyPartnerCertification,
  submitQualification,
  approveQualification,
  listServiceCategories,
} from "@/lib/api/partner-capabilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { DocumentList } from "@/components/documents/document-list";
import { CapacityHeatmap } from "@/components/partners/capacity-heatmap";
import { CapabilityMatrix } from "@/components/partners/capability-matrix";
import { CertificationList } from "@/components/partners/certification-list";
import { QualificationCard } from "@/components/partners/qualification-card";
import { Progress } from "@/components/ui/progress";
import { BookmarkButton } from "@/components/ui/bookmark-button";
import type { ProficiencyLevel, ApprovalStatus, CertificationStatus } from "@/types/partner-capability";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  inactive: "secondary",
  suspended: "destructive",
  draft: "outline",
};

const ASSIGNMENT_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  dispatched: "secondary",
  accepted: "default",
  in_progress: "default",
  completed: "default",
  cancelled: "destructive",
};

export default function PartnerDetailPage() {
  const params = useParams();
  const partnerId = params.id as string;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isMD = user?.role === "managing_director";

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<PartnerUpdateData>({});
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [provisionPassword, setProvisionPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [noticeDialogOpen, setNoticeDialogOpen] = useState(false);

  const { data: partner, isLoading } = useQuery({
    queryKey: ["partners", partnerId],
    queryFn: () => getPartner(partnerId),
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ["assignments", { partner_id: partnerId }],
    queryFn: () => listAssignments({ partner_id: partnerId }),
    enabled: !!partnerId,
  });

  const { data: noticesData } = useQuery({
    queryKey: ["performance-notices", partnerId],
    queryFn: () => listPartnerNotices(partnerId),
    enabled: !!partnerId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: PartnerUpdateData) => updatePartner(partnerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners", partnerId] });
      setEditing(false);
      setError(null);
    },
    onError: () => {
      setError("Failed to update partner.");
    },
  });

  const provisionMutation = useMutation({
    mutationFn: () =>
      provisionPartner(partnerId, {
        password: provisionPassword || undefined,
        send_welcome_email: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners", partnerId] });
      setProvisionOpen(false);
      setProvisionPassword("");
    },
    onError: () => {
      setError("Failed to provision partner user.");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadComplianceDoc(partnerId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners", partnerId] });
    },
    onError: () => {
      setError("Failed to upload compliance document.");
    },
  });

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const startEditing = () => {
    if (!partner) return;
    setEditData({
      firm_name: partner.firm_name,
      contact_name: partner.contact_name,
      contact_email: partner.contact_email,
      contact_phone: partner.contact_phone || undefined,
      capabilities: partner.capabilities,
      geographies: partner.geographies,
      availability_status: partner.availability_status,
      notes: partner.notes || undefined,
      status: partner.status,
    });
    setEditing(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground text-sm">Loading partner...</p>
        </div>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground">Partner not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              {partner.firm_name}
            </h1>
            <BookmarkButton
              entityType="partner"
              entityId={partnerId}
              entityTitle={partner.firm_name}
              entitySubtitle={partner.contact_name}
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[partner.status] ?? "outline"}>
              {partner.status.replace(/_/g, " ")}
            </Badge>
            {partner.is_on_probation && (
              <Badge
                variant="outline"
                className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 gap-1"
              >
                <ShieldAlert className="h-3 w-3" />
                Probationary
              </Badge>
            )}
            {!editing && (
              <Button variant="outline" onClick={startEditing}>
                Edit
              </Button>
            )}
            {isMD && (
              <Button
                variant="destructive"
                onClick={() => setNoticeDialogOpen(true)}
              >
                Issue Performance Notice
              </Button>
            )}
            {!partner.user_id && (
              <Dialog open={provisionOpen} onOpenChange={setProvisionOpen}>
                <DialogTrigger asChild>
                  <Button>Provision User</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Provision Partner User</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Password (optional, auto-generated if empty)</Label>
                      <Input
                        type="password"
                        value={provisionPassword}
                        onChange={(e) => setProvisionPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => provisionMutation.mutate()}
                      disabled={provisionMutation.isPending}
                    >
                      {provisionMutation.isPending
                        ? "Provisioning..."
                        : "Provision"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {partner.is_on_probation && (
          <Alert className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-900 dark:text-amber-300">Probationary Partner</AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-300">
              This partner is under enhanced oversight for their first three engagements.{" "}
              <span className="font-semibold">
                {partner.completed_assignments} of 3 qualifying engagements completed.
              </span>{" "}
              Apply additional review steps to all deliverables and communications.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="governance">Governance</TabsTrigger>
            <TabsTrigger value="notices" className="relative">
              Performance Notices
              {noticesData && noticesData.unacknowledged_count > 0 && (
                <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                  {noticesData.unacknowledged_count}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="trends">Performance Trends</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {editing ? (
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-lg">
                    Edit Partner
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Firm Name</Label>
                    <Input
                      value={editData.firm_name ?? ""}
                      onChange={(e) =>
                        setEditData((d) => ({
                          ...d,
                          firm_name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Name</Label>
                    <Input
                      value={editData.contact_name ?? ""}
                      onChange={(e) =>
                        setEditData((d) => ({
                          ...d,
                          contact_name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Email</Label>
                    <Input
                      value={editData.contact_email ?? ""}
                      onChange={(e) =>
                        setEditData((d) => ({
                          ...d,
                          contact_email: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Phone</Label>
                    <Input
                      value={editData.contact_phone ?? ""}
                      onChange={(e) =>
                        setEditData((d) => ({
                          ...d,
                          contact_phone: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Availability</Label>
                    <Select
                      value={editData.availability_status ?? undefined}
                      onValueChange={(value) =>
                        setEditData((d) => ({
                          ...d,
                          availability_status: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="busy">Busy</SelectItem>
                        <SelectItem value="unavailable">
                          Unavailable
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={editData.status ?? undefined}
                      onValueChange={(value) =>
                        setEditData((d) => ({ ...d, status: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={editData.notes ?? ""}
                      onChange={(e) =>
                        setEditData((d) => ({ ...d, notes: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => updateMutation.mutate(editData)}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditing(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">
                        Contact Name
                      </p>
                      <p className="font-medium">{partner.contact_name}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{partner.contact_email}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">
                        {partner.contact_phone ?? "-"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">
                        Availability
                      </p>
                      <Badge
                        variant={
                          partner.availability_status === "available"
                            ? "default"
                            : partner.availability_status === "busy"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {partner.availability_status.replace(/_/g, " ")}
                      </Badge>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Rating</p>
                      <p className="font-medium">
                        {partner.performance_rating != null
                          ? Number(partner.performance_rating).toFixed(1)
                          : "Not rated"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">
                        Assignments
                      </p>
                      <p className="font-medium">
                        {partner.completed_assignments} /{" "}
                        {partner.total_assignments} completed
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Capabilities
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {partner.capabilities.map((cap) => (
                        <Badge key={cap} variant="secondary">
                          {cap}
                        </Badge>
                      ))}
                      {partner.capabilities.length === 0 && (
                        <span className="text-sm text-muted-foreground">
                          None
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Geographies
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {partner.geographies.map((geo) => (
                        <Badge key={geo} variant="outline">
                          {geo}
                        </Badge>
                      ))}
                      {partner.geographies.length === 0 && (
                        <span className="text-sm text-muted-foreground">
                          None
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {partner.notes && (
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Notes</p>
                      <p className="text-sm mt-1">{partner.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="capabilities" className="space-y-4">
            <CapabilitiesTabContent partnerId={partnerId} />
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            <div className="rounded-md border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignmentsData?.assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/assignments/${assignment.id}`}
                          className="hover:underline"
                        >
                          {assignment.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {assignment.program_title ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            ASSIGNMENT_STATUS_VARIANT[assignment.status] ??
                            "outline"
                          }
                        >
                          {assignment.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {assignment.due_date
                          ? new Date(
                              assignment.due_date
                            ).toLocaleDateString()
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!assignmentsData ||
                    assignmentsData.assignments.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        No assignments found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-lg">
                  Compliance Document
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Verified Status
                  </p>
                  <Badge
                    variant={
                      partner.compliance_verified ? "default" : "secondary"
                    }
                  >
                    {partner.compliance_verified ? "Verified" : "Not Verified"}
                  </Badge>
                </div>

                {partner.compliance_doc_url && (
                  <div>
                    <p className="text-sm text-muted-foreground">Document</p>
                    <a
                      href={partner.compliance_doc_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      View Document
                    </a>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Upload Compliance Document</Label>
                  <Input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploadMutation.isPending}
                  />
                  {uploadMutation.isPending && (
                    <p className="text-sm text-muted-foreground">
                      Uploading...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <DocumentList entityType="partner" entityId={partnerId} />
          </TabsContent>

          <TabsContent value="governance" className="space-y-4">
            <GovernanceTabContent partnerId={partnerId} partnerName={partner.firm_name} isMD={isMD} />
          </TabsContent>

          <TabsContent value="notices" className="space-y-4">
            <PerformanceNoticesTabContent
              notices={noticesData?.notices ?? []}
              total={noticesData?.total ?? 0}
              unacknowledgedCount={noticesData?.unacknowledged_count ?? 0}
              isMD={isMD}
              onIssueNotice={() => setNoticeDialogOpen(true)}
            />
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <TrendsTabContent partnerId={partnerId} />
          </TabsContent>

          <TabsContent value="availability" className="space-y-4">
            <CapacityHeatmap partnerId={partnerId} />
          </TabsContent>
        </Tabs>
      </div>

      <PerformanceNoticeDialog
        open={noticeDialogOpen}
        onOpenChange={setNoticeDialogOpen}
        partnerId={partnerId}
        partnerName={partner.firm_name}
        programs={
          assignmentsData?.assignments
            .filter((a) => a.program_id && a.program_title)
            .map((a) => ({
              program_id: a.program_id,
              program_title: a.program_title,
            })) ?? []
        }
      />
    </div>
  );
}

// Separate component for the capabilities tab to manage its own state
function CapabilitiesTabContent({ partnerId }: { partnerId: string }) {
  const queryClient = useQueryClient();

  // Fetch capability matrix data
  const { data: matrixData, isLoading: matrixLoading } = useQuery({
    queryKey: ["capability-matrix", partnerId],
    queryFn: () => getCapabilityMatrix(partnerId),
  });

  // Fetch service categories
  const { data: categoriesData } = useQuery({
    queryKey: ["service-categories"],
    queryFn: () => listServiceCategories(true),
  });

  // Capability mutations
  const addCapabilityMutation = useMutation({
    mutationFn: (data: {
      capability_name: string;
      proficiency_level: ProficiencyLevel;
      years_experience?: number;
      notes?: string;
    }) => addPartnerCapability(partnerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-matrix", partnerId] });
    },
  });

  const updateCapabilityMutation = useMutation({
    mutationFn: ({
      capabilityId,
      data,
    }: {
      capabilityId: string;
      data: {
        capability_name?: string;
        proficiency_level?: ProficiencyLevel;
        years_experience?: number;
        notes?: string;
      };
    }) => updatePartnerCapability(partnerId, capabilityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-matrix", partnerId] });
    },
  });

  const deleteCapabilityMutation = useMutation({
    mutationFn: (capabilityId: string) => deletePartnerCapability(partnerId, capabilityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-matrix", partnerId] });
    },
  });

  const verifyCapabilityMutation = useMutation({
    mutationFn: (capabilityId: string) => verifyPartnerCapability(partnerId, capabilityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-matrix", partnerId] });
    },
  });

  // Certification mutations
  const addCertificationMutation = useMutation({
    mutationFn: (data: {
      name: string;
      issuing_body: string;
      certificate_number?: string;
      issue_date?: string;
      expiry_date?: string;
      notes?: string;
    }) => addPartnerCertification(partnerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-matrix", partnerId] });
    },
  });

  const uploadCertDocMutation = useMutation({
    mutationFn: ({ certId, file }: { certId: string; file: File }) =>
      uploadCertificationDocument(partnerId, certId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-matrix", partnerId] });
    },
  });

  const verifyCertificationMutation = useMutation({
    mutationFn: ({
      certId,
      data,
    }: {
      certId: string;
      data: { status: CertificationStatus; notes?: string };
    }) => verifyPartnerCertification(partnerId, certId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-matrix", partnerId] });
    },
  });

  // Qualification mutations
  const submitQualificationMutation = useMutation({
    mutationFn: (data: {
      category_id: string;
      qualification_level: "qualified" | "preferred" | "expert";
      notes?: string;
    }) => submitQualification(partnerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-matrix", partnerId] });
    },
  });

  const approveQualificationMutation = useMutation({
    mutationFn: ({
      qualId,
      data,
    }: {
      qualId: string;
      data: { status: ApprovalStatus; notes?: string };
    }) => approveQualification(partnerId, qualId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-matrix", partnerId] });
    },
  });

  if (matrixLoading) {
    return <p className="text-muted-foreground text-sm">Loading capabilities...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Onboarding Progress (if applicable) */}
      {matrixData?.onboarding && matrixData.onboarding.current_stage !== "completed" && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Onboarding Progress</CardTitle>
              <span className="text-sm text-muted-foreground">
                {matrixData.onboarding.progress_percentage}%
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={matrixData.onboarding.progress_percentage} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              Current Stage: {matrixData.onboarding.current_stage.replace(/_/g, " ")}
            </p>
            {matrixData.onboarding.coordinator_name && (
              <p className="text-sm text-muted-foreground">
                Coordinator: {matrixData.onboarding.coordinator_name}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Capability Matrix */}
      <CapabilityMatrix
        capabilities={matrixData?.capabilities ?? []}
        onAdd={async (data) => {
          await addCapabilityMutation.mutateAsync(data);
        }}
        onUpdate={async (capabilityId, data) => {
          await updateCapabilityMutation.mutateAsync({ capabilityId, data });
        }}
        onDelete={async (capabilityId) => {
          await deleteCapabilityMutation.mutateAsync(capabilityId);
        }}
        onVerify={async (capabilityId) => {
          await verifyCapabilityMutation.mutateAsync(capabilityId);
        }}
        canEdit={true}
        canVerify={true}
      />

      {/* Service Qualifications */}
      <QualificationCard
        qualifications={matrixData?.qualifications ?? []}
        serviceCategories={categoriesData?.categories ?? []}
        onSubmit={async (data) => {
          await submitQualificationMutation.mutateAsync(data);
        }}
        onApprove={async (qualId, data) => {
          await approveQualificationMutation.mutateAsync({ qualId, data });
        }}
        canEdit={true}
        canApprove={true}
      />

      {/* Certifications */}
      <CertificationList
        certifications={matrixData?.certifications ?? []}
        onAdd={async (data) => {
          const result = await addCertificationMutation.mutateAsync(data);
          return result;
        }}
        onUploadDocument={async (certId, file) => {
          await uploadCertDocMutation.mutateAsync({ certId, file });
        }}
        onVerify={async (certId, data) => {
          await verifyCertificationMutation.mutateAsync({ certId, data });
        }}
        canEdit={true}
        canVerify={true}
      />

      {/* Summary Stats */}
      {matrixData && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Capability Summary</p>
              <div className="flex gap-3 mt-2">
                {Object.entries(matrixData.capability_summary).map(([level, count]) => (
                  <Badge key={level} variant="secondary">
                    {level}: {count}
                  </Badge>
                ))}
                {Object.keys(matrixData.capability_summary).length === 0 && (
                  <span className="text-sm text-muted-foreground">No capabilities</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Qualification Summary</p>
              <div className="flex gap-3 mt-2">
                {Object.entries(matrixData.qualification_summary).map(([status, count]) => (
                  <Badge key={status} variant="secondary">
                    {status}: {count}
                  </Badge>
                ))}
                {Object.keys(matrixData.qualification_summary).length === 0 && (
                  <span className="text-sm text-muted-foreground">No qualifications</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

const GOVERNANCE_ACTION_LABELS: Record<string, string> = {
  warning: "Warning",
  probation: "Probation",
  suspension: "Suspension",
  termination: "Termination",
  reinstatement: "Reinstatement",
};

const GOVERNANCE_ACTION_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  warning: "secondary",
  probation: "outline",
  suspension: "destructive",
  termination: "destructive",
  reinstatement: "default",
};

function GovernanceTabContent({
  partnerId,
  partnerName,
  isMD,
}: {
  partnerId: string;
  partnerName: string;
  isMD: boolean;
}) {
  const [govDialogOpen, setGovDialogOpen] = useState(false);

  const { data: compositeScore, isLoading: scoreLoading } = useQuery({
    queryKey: ["composite-score", partnerId],
    queryFn: () => getCompositeScore(partnerId),
  });

  const { data: governanceHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["governance-history", partnerId],
    queryFn: () => getGovernanceHistory(partnerId),
  });

  if (scoreLoading || historyLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading governance data...
      </p>
    );
  }

  const actions = governanceHistory?.actions ?? [];

  return (
    <div className="space-y-4">
      {compositeScore && <PartnerScoreCard data={compositeScore} />}

      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold">
          Governance History
        </h3>
        {isMD && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setGovDialogOpen(true)}
          >
            Apply Governance Action
          </Button>
        )}
      </div>

      {actions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No governance actions on record for this partner.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {actions.map((action: GovernanceActionType) => (
            <Card key={action.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        GOVERNANCE_ACTION_VARIANT[action.action] ?? "outline"
                      }
                    >
                      {GOVERNANCE_ACTION_LABELS[action.action] ??
                        action.action}
                    </Badge>
                    {action.expiry_date && (
                      <span className="text-xs text-muted-foreground">
                        Expires{" "}
                        {new Date(action.expiry_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(action.effective_date).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {action.reason}
                </p>
                <div className="text-xs text-muted-foreground pt-1 border-t">
                  Issued by {action.issuer_name ?? "Managing Director"}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GovernanceActionForm
        partnerId={partnerId}
        partnerName={partnerName}
        open={govDialogOpen}
        onOpenChange={setGovDialogOpen}
      />
    </div>
  );
}

const NOTICE_TYPE_LABELS: Record<string, string> = {
  sla_breach: "SLA Breach",
  quality_issue: "Quality Issue",
  general_performance: "General Performance",
};

const SEVERITY_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  warning: "secondary",
  formal_notice: "default",
  final_notice: "destructive",
};

function PerformanceNoticesTabContent({
  notices,
  total,
  unacknowledgedCount,
  isMD,
  onIssueNotice,
}: {
  notices: PerformanceNotice[];
  total: number;
  unacknowledgedCount: number;
  isMD: boolean;
  onIssueNotice: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {total} notice{total !== 1 ? "s" : ""} on record
            {unacknowledgedCount > 0 && (
              <span className="ml-2 text-destructive font-medium">
                · {unacknowledgedCount} unacknowledged
              </span>
            )}
          </p>
        </div>
        {isMD && (
          <Button variant="destructive" size="sm" onClick={onIssueNotice}>
            Issue Performance Notice
          </Button>
        )}
      </div>

      {notices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No performance notices on record for this partner.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => (
            <Card
              key={notice.id}
              className={
                notice.status === "open"
                  ? "border-destructive/40 bg-destructive/5"
                  : ""
              }
            >
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={SEVERITY_VARIANT[notice.severity] ?? "outline"}>
                      {notice.severity.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="outline">
                      {NOTICE_TYPE_LABELS[notice.notice_type] ?? notice.notice_type}
                    </Badge>
                    {notice.status === "open" ? (
                      <Badge variant="destructive">Unacknowledged</Badge>
                    ) : (
                      <Badge variant="secondary">Acknowledged</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(notice.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div>
                  <p className="font-medium text-sm">{notice.title}</p>
                  {notice.program_title && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Program: {notice.program_title}
                    </p>
                  )}
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  {notice.description}
                </p>

                {notice.required_action && (
                  <div className="rounded-md bg-muted px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                      Required Action
                    </p>
                    <p className="text-sm">{notice.required_action}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                  <span>
                    Issued by {notice.issuer_name ?? "Managing Director"}
                  </span>
                  {notice.acknowledged_at && (
                    <span>
                      Acknowledged{" "}
                      {new Date(notice.acknowledged_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Trends Tab ────────────────────────────────────────────────────────────────

function TrendsTabContent({ partnerId }: { partnerId: string }) {
  const [dateRange, setDateRange] = useState<30 | 90 | 365>(90);

  const { data: trends, isLoading } = useQuery({
    queryKey: ["partner-trends", partnerId, dateRange],
    queryFn: () => getPartnerTrends(partnerId, dateRange),
    enabled: !!partnerId,
  });

  return (
    <PerformanceChart
      trends={trends}
      isLoading={isLoading}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
    />
  );
}
