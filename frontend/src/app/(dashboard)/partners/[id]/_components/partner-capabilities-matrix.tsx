"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CapabilityMatrix } from "@/components/partners/capability-matrix";
import { CertificationList } from "@/components/partners/certification-list";
import { QualificationCard } from "@/components/partners/qualification-card";
import type { ProficiencyLevel, ApprovalStatus, CertificationStatus } from "@/types/partner-capability";

interface PartnerCapabilitiesMatrixProps {
  partnerId: string;
}

export function PartnerCapabilitiesMatrix({ partnerId }: PartnerCapabilitiesMatrixProps) {
  const queryClient = useQueryClient();

  const { data: matrixData, isLoading: matrixLoading } = useQuery({
    queryKey: ["capability-matrix", partnerId],
    queryFn: () => getCapabilityMatrix(partnerId),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["service-categories"],
    queryFn: () => listServiceCategories(true),
  });

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
