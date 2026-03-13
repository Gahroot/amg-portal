"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  ChevronRight,
  Clock,
  User,
  FileText,
  Award,
  Shield,
  ArrowLeft,
  UserPlus,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import { Label } from "@/components/ui/label";
import {
  type PartnerOnboarding,
  type OnboardingStage,
  ONBOARDING_STAGES,
  DEFAULT_CHECKLIST_ITEMS,
  CERTIFICATION_STATUS_LABELS,
  CERTIFICATION_STATUS_COLORS,
} from "@/types/partner-capability";
import {
  getPartnerOnboarding,
  getCapabilityMatrix,
  completeOnboardingStage,
  updateOnboarding,
  startOnboarding,
} from "@/lib/api/partner-capabilities";
import { getPartner } from "@/lib/api/partners";
import { listUsers } from "@/lib/api/users";

const STAGE_ICONS: Record<OnboardingStage, React.ReactNode> = {
  profile_setup: <User className="h-5 w-5" />,
  capability_matrix: <Award className="h-5 w-5" />,
  compliance_docs: <Shield className="h-5 w-5" />,
  certification_upload: <FileText className="h-5 w-5" />,
  review: <Clock className="h-5 w-5" />,
  completed: <Check className="h-5 w-5" />,
};

export default function PartnerOnboardingReviewPage() {
  const params = useParams();
  const partnerId = params.id as string;
  const queryClient = useQueryClient();

  const [assignDialogOpen, setAssignDialogOpen] = React.useState(false);
  const [selectedCoordinator, setSelectedCoordinator] = React.useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
  const [rejectStage, setRejectStage] = React.useState<OnboardingStage | null>(
    null
  );
  const [rejectNotes, setRejectNotes] = React.useState("");

  // Fetch partner details
  const { data: partner, isLoading: partnerLoading } = useQuery({
    queryKey: ["partners", partnerId],
    queryFn: () => getPartner(partnerId),
  });

  // Fetch onboarding data
  const {
    data: onboarding,
    isLoading: onboardingLoading,
  } = useQuery({
    queryKey: ["partner-onboarding", partnerId],
    queryFn: async () => {
      const data = await getPartnerOnboarding(partnerId);
      return data as PartnerOnboarding | null;
    },
  });

  // Fetch capability matrix
  const { data: matrixData } = useQuery({
    queryKey: ["capability-matrix", partnerId],
    queryFn: () => getCapabilityMatrix(partnerId),
    enabled: !!onboarding,
  });

  // Fetch coordinators (admin / coordinator users)
  const { data: usersData } = useQuery({
    queryKey: ["users", { role: "admin" }],
    queryFn: () => listUsers({ role: "admin", limit: 100 }),
  });

  const coordinators = usersData?.users ?? [];

  // ---- Mutations ----

  const startOnboardingMutation = useMutation({
    mutationFn: () =>
      startOnboarding(partnerId, {
        assigned_coordinator: selectedCoordinator || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["partner-onboarding", partnerId],
      });
      toast.success("Onboarding started");
    },
    onError: () => toast.error("Failed to start onboarding"),
  });

  const assignCoordinatorMutation = useMutation({
    mutationFn: (coordinatorId: string) =>
      updateOnboarding(partnerId, { assigned_coordinator: coordinatorId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["partner-onboarding", partnerId],
      });
      setAssignDialogOpen(false);
      toast.success("Coordinator assigned");
    },
    onError: () => toast.error("Failed to assign coordinator"),
  });

  const approveStage = useMutation({
    mutationFn: (stage: OnboardingStage) =>
      completeOnboardingStage(partnerId, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["partner-onboarding", partnerId],
      });
      toast.success("Stage approved");
    },
    onError: () => toast.error("Failed to approve stage"),
  });

  const rejectStageMutation = useMutation({
    mutationFn: ({
      stage,
    }: {
      stage: OnboardingStage;
      notes: string;
    }) => {
      // Rejecting means rolling back to the stage (uncompleting it)
      const updatedCompleted =
        onboarding?.completed_stages.filter((s) => s !== stage) ?? [];
      return updateOnboarding(partnerId, {
        current_stage: stage,
        completed_stages: updatedCompleted,
        checklist_items: {
          ...onboarding?.checklist_items,
          [stage]: Object.fromEntries(
            Object.keys(DEFAULT_CHECKLIST_ITEMS[stage] || {}).map((k) => [
              k,
              false,
            ])
          ),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["partner-onboarding", partnerId],
      });
      setRejectDialogOpen(false);
      setRejectNotes("");
      setRejectStage(null);
      toast.success("Stage returned for revision");
    },
    onError: () => toast.error("Failed to reject stage"),
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: () =>
      completeOnboardingStage(partnerId, {
        stage: "completed" as OnboardingStage,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["partner-onboarding", partnerId],
      });
      toast.success("Onboarding approved — partner is now active!");
    },
    onError: () => toast.error("Failed to complete onboarding"),
  });

  // ---- Loading / empty states ----

  const isLoading = partnerLoading || onboardingLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground">Partner not found.</p>
        </div>
      </div>
    );
  }

  // No onboarding yet — offer to start one
  if (!onboarding) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dashboard/partners/${partnerId}`}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
            </Button>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              Onboarding — {partner.firm_name}
            </h1>
          </div>

          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <p className="text-muted-foreground">
                No onboarding has been started for this partner.
              </p>
              <div className="flex items-center justify-center gap-3">
                {coordinators.length > 0 && (
                  <Select
                    value={selectedCoordinator}
                    onValueChange={setSelectedCoordinator}
                  >
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Assign coordinator (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {coordinators.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  onClick={() => startOnboardingMutation.mutate()}
                  disabled={startOnboardingMutation.isPending}
                >
                  {startOnboardingMutation.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-1 h-4 w-4" />
                  )}
                  Start Onboarding
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isCompleted = onboarding.current_stage === "completed";
  const actionableStages = ONBOARDING_STAGES.filter(
    (s) => s.id !== "completed"
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dashboard/partners/${partnerId}`}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="font-serif text-3xl font-bold tracking-tight">
                Onboarding — {partner.firm_name}
              </h1>
              <p className="text-muted-foreground mt-1">
                Review and manage partner onboarding progress
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <Badge variant="default" className="py-1.5 px-3 text-sm">
                <Check className="h-4 w-4 mr-1" />
                Complete
              </Badge>
            ) : (
              <Badge variant="secondary" className="py-1.5 px-3 text-sm">
                In Progress
              </Badge>
            )}
          </div>
        </div>

        {/* Status Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Progress</p>
              <p className="text-2xl font-bold">
                {onboarding.progress_percentage}%
              </p>
              <Progress
                value={onboarding.progress_percentage}
                className="h-1.5 mt-2"
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Current Stage</p>
              <p className="font-medium mt-1">
                {ONBOARDING_STAGES.find(
                  (s) => s.id === onboarding.current_stage
                )?.label ?? "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Coordinator</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="font-medium">
                  {onboarding.coordinator_name ?? "Unassigned"}
                </p>
                <Dialog
                  open={assignDialogOpen}
                  onOpenChange={setAssignDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-2">
                      <UserPlus className="h-3 w-3" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Assign Coordinator</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Label>Select Coordinator</Label>
                      <Select
                        value={selectedCoordinator}
                        onValueChange={setSelectedCoordinator}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a coordinator" />
                        </SelectTrigger>
                        <SelectContent>
                          {coordinators.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.full_name} ({u.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() =>
                          assignCoordinatorMutation.mutate(selectedCoordinator)
                        }
                        disabled={
                          !selectedCoordinator ||
                          assignCoordinatorMutation.isPending
                        }
                      >
                        {assignCoordinatorMutation.isPending ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : null}
                        Assign
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Started</p>
              <p className="font-medium mt-1">
                {new Date(onboarding.started_at).toLocaleDateString()}
              </p>
              {onboarding.completed_at && (
                <>
                  <p className="text-sm text-muted-foreground mt-2">
                    Completed
                  </p>
                  <p className="font-medium">
                    {new Date(onboarding.completed_at).toLocaleDateString()}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stage Progress Indicator */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Stage Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {actionableStages.map((stage, index) => {
                const stageCompleted = onboarding.completed_stages.includes(
                  stage.id
                );
                const isCurrent = stage.id === onboarding.current_stage;

                return (
                  <React.Fragment key={stage.id}>
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                          stageCompleted
                            ? "bg-green-100 text-green-600"
                            : isCurrent
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {stageCompleted ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          STAGE_ICONS[stage.id]
                        )}
                      </div>
                      <span
                        className={`text-xs mt-1 text-center max-w-[80px] ${
                          isCurrent ? "font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {stage.label}
                      </span>
                    </div>
                    {index < actionableStages.length - 1 && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Stage-by-stage review */}
        <div className="space-y-4">
          {actionableStages.map((stage) => {
            const stageCompleted = onboarding.completed_stages.includes(
              stage.id
            );
            const isCurrent = stage.id === onboarding.current_stage;
            const checklistEntries = Object.entries(
              DEFAULT_CHECKLIST_ITEMS[stage.id] || {}
            );
            const checkedCount = checklistEntries.filter(
              ([key]) =>
                onboarding.checklist_items?.[stage.id]?.[key] === true
            ).length;

            return (
              <Card
                key={stage.id}
                className={
                  isCurrent
                    ? "border-primary/50"
                    : stageCompleted
                      ? "border-green-200"
                      : ""
                }
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          stageCompleted
                            ? "bg-green-100 text-green-600"
                            : isCurrent
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {stageCompleted ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          STAGE_ICONS[stage.id]
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {stage.label}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {stage.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          stageCompleted
                            ? "default"
                            : isCurrent
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {stageCompleted
                          ? "Approved"
                          : isCurrent
                            ? `${checkedCount}/${checklistEntries.length}`
                            : "Pending"}
                      </Badge>
                      {/* Approve / Reject actions */}
                      {!stageCompleted &&
                        isCurrent &&
                        stage.id !== "review" && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approveStage.mutate(stage.id)}
                              disabled={approveStage.isPending}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-green-600" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRejectStage(stage.id);
                                setRejectDialogOpen(true);
                              }}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1 text-red-600" />
                              Return
                            </Button>
                          </div>
                        )}
                      {stageCompleted && stage.id !== "review" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setRejectStage(stage.id);
                            setRejectDialogOpen(true);
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1 text-red-600" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Checklist items */}
                  <div className="space-y-2">
                    {checklistEntries.map(([key, label]) => {
                      const isChecked =
                        onboarding.checklist_items?.[stage.id]?.[key] === true;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          {isChecked ? (
                            <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <div className="h-4 w-4 rounded-sm border flex-shrink-0" />
                          )}
                          <span
                            className={`text-sm ${isChecked ? "" : "text-muted-foreground"}`}
                          >
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Submitted Documents & Certifications */}
        {matrixData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Capabilities */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Capabilities</CardTitle>
              </CardHeader>
              <CardContent>
                {matrixData.capabilities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No capabilities added yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Capability</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Verified</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matrixData.capabilities.map((cap) => (
                        <TableRow key={cap.id}>
                          <TableCell className="font-medium">
                            {cap.capability_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {cap.proficiency_level}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {cap.verified ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                No
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Certifications */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Certifications</CardTitle>
              </CardHeader>
              <CardContent>
                {matrixData.certifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No certifications submitted yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Issuer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Document</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matrixData.certifications.map((cert) => (
                        <TableRow key={cert.id}>
                          <TableCell className="font-medium">
                            {cert.name}
                          </TableCell>
                          <TableCell>{cert.issuing_body}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                CERTIFICATION_STATUS_COLORS[
                                  cert.verification_status
                                ] ?? ""
                              }`}
                            >
                              {CERTIFICATION_STATUS_LABELS[
                                cert.verification_status
                              ] ?? cert.verification_status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {cert.document_url ? (
                              <a
                                href={cert.document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline inline-flex items-center gap-1"
                              >
                                View{" "}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                —
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Compliance Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Compliance Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
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
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View Document <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Final Approval */}
        {!isCompleted && onboarding.current_stage === "review" && (
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader>
              <CardTitle className="text-lg">Final Approval</CardTitle>
              <CardDescription>
                All stages have been submitted by the partner. Review the
                details above and approve or reject the onboarding.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button
                  onClick={() => completeOnboardingMutation.mutate()}
                  disabled={completeOnboardingMutation.isPending}
                >
                  {completeOnboardingMutation.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                  )}
                  Approve Onboarding
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setRejectStage("review");
                    setRejectDialogOpen(true);
                  }}
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  Reject &amp; Return
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completed Banner */}
        {isCompleted && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3">
                <Check className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold mb-1">
                Onboarding Complete
              </h2>
              <p className="text-sm text-muted-foreground">
                {partner.firm_name} has been fully onboarded and activated.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Reject / Return Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Return Stage for Revision</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Label>Notes for Partner</Label>
              <Textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Explain what needs to be revised…"
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRejectDialogOpen(false);
                  setRejectNotes("");
                  setRejectStage(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={rejectStageMutation.isPending || !rejectStage}
                onClick={() => {
                  if (rejectStage) {
                    rejectStageMutation.mutate({
                      stage: rejectStage,
                      notes: rejectNotes,
                    });
                  }
                }}
              >
                {rejectStageMutation.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : null}
                Return for Revision
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
