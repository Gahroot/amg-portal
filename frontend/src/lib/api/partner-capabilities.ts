/**
 * API client for partner capability matrix, qualifications, certifications, and onboarding.
 */

import api from "@/lib/api";
import type {
  CapabilityCreate,
  CapabilityListResponse,
  CapabilityMatrixResponse,
  CapabilityUpdate,
  CertificationCreate,
  CertificationListResponse,
  CertificationVerification,
  OnboardingCreate,
  OnboardingResponse,
  OnboardingStageComplete,
  OnboardingUpdate,
  PartnerCapability,
  PartnerCertification,
  PartnerOnboarding,
  PartnerQualification,
  QualificationApproval,
  QualificationCreate,
  QualificationListResponse,
  ServiceCategory,
  ServiceCategoryCreate,
  ServiceCategoryListResponse,
  ServiceCategoryUpdate,
} from "@/types/partner-capability";

// ============================================================================
// Service Categories
// ============================================================================

export async function listServiceCategories(
  activeOnly: boolean = true
): Promise<ServiceCategoryListResponse> {
  const response = await api.get<ServiceCategoryListResponse>("/api/v1/partners/service-categories", {
    params: { active_only: activeOnly },
  });
  return response.data;
}

export async function createServiceCategory(data: ServiceCategoryCreate): Promise<ServiceCategory> {
  const response = await api.post<ServiceCategory>("/api/v1/partners/service-categories", data);
  return response.data;
}

export async function updateServiceCategory(
  categoryId: string,
  data: ServiceCategoryUpdate
): Promise<ServiceCategory> {
  const response = await api.patch<ServiceCategory>(
    `/api/v1/partners/service-categories/${categoryId}`,
    data
  );
  return response.data;
}

// ============================================================================
// Partner Capabilities
// ============================================================================

export async function getPartnerCapabilities(partnerId: string): Promise<CapabilityListResponse> {
  const response = await api.get<CapabilityListResponse>(
    `/api/v1/partners/${partnerId}/capabilities`
  );
  return response.data;
}

export async function addPartnerCapability(
  partnerId: string,
  data: CapabilityCreate
): Promise<PartnerCapability> {
  const response = await api.post<PartnerCapability>(
    `/api/v1/partners/${partnerId}/capabilities`,
    data
  );
  return response.data;
}

export async function updatePartnerCapability(
  partnerId: string,
  capabilityId: string,
  data: CapabilityUpdate
): Promise<PartnerCapability> {
  const response = await api.patch<PartnerCapability>(
    `/api/v1/partners/${partnerId}/capabilities/${capabilityId}`,
    data
  );
  return response.data;
}

export async function deletePartnerCapability(
  partnerId: string,
  capabilityId: string
): Promise<void> {
  await api.delete(`/api/v1/partners/${partnerId}/capabilities/${capabilityId}`);
}

export async function verifyPartnerCapability(
  partnerId: string,
  capabilityId: string
): Promise<PartnerCapability> {
  const response = await api.post<PartnerCapability>(
    `/api/v1/partners/${partnerId}/capabilities/${capabilityId}/verify`
  );
  return response.data;
}

// ============================================================================
// Partner Qualifications
// ============================================================================

export async function getPartnerQualifications(
  partnerId: string
): Promise<QualificationListResponse> {
  const response = await api.get<QualificationListResponse>(
    `/api/v1/partners/${partnerId}/qualifications`
  );
  return response.data;
}

export async function submitQualification(
  partnerId: string,
  data: QualificationCreate
): Promise<PartnerQualification> {
  const response = await api.post<PartnerQualification>(
    `/api/v1/partners/${partnerId}/qualifications`,
    data
  );
  return response.data;
}

export async function approveQualification(
  partnerId: string,
  qualificationId: string,
  data: QualificationApproval
): Promise<PartnerQualification> {
  const response = await api.patch<PartnerQualification>(
    `/api/v1/partners/${partnerId}/qualifications/${qualificationId}`,
    data
  );
  return response.data;
}

// ============================================================================
// Partner Certifications
// ============================================================================

export async function getPartnerCertifications(
  partnerId: string
): Promise<CertificationListResponse> {
  const response = await api.get<CertificationListResponse>(
    `/api/v1/partners/${partnerId}/certifications`
  );
  return response.data;
}

export async function addPartnerCertification(
  partnerId: string,
  data: CertificationCreate
): Promise<PartnerCertification> {
  const response = await api.post<PartnerCertification>(
    `/api/v1/partners/${partnerId}/certifications`,
    data
  );
  return response.data;
}

export async function uploadCertificationDocument(
  partnerId: string,
  certificationId: string,
  file: File
): Promise<PartnerCertification> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<PartnerCertification>(
    `/api/v1/partners/${partnerId}/certifications/${certificationId}/document`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return response.data;
}

export async function verifyPartnerCertification(
  partnerId: string,
  certificationId: string,
  data: CertificationVerification
): Promise<PartnerCertification> {
  const response = await api.post<PartnerCertification>(
    `/api/v1/partners/${partnerId}/certifications/${certificationId}/verify`,
    data
  );
  return response.data;
}

// ============================================================================
// Partner Onboarding
// ============================================================================

export async function getPartnerOnboarding(partnerId: string): Promise<OnboardingResponse | null> {
  const response = await api.get<OnboardingResponse | null>(
    `/api/v1/partners/${partnerId}/onboarding`
  );
  return response.data;
}

export async function startOnboarding(
  partnerId: string,
  data: OnboardingCreate = {}
): Promise<PartnerOnboarding> {
  const response = await api.post<PartnerOnboarding>(
    `/api/v1/partners/${partnerId}/onboarding`,
    data
  );
  return response.data;
}

export async function updateOnboarding(
  partnerId: string,
  data: OnboardingUpdate
): Promise<PartnerOnboarding> {
  const response = await api.patch<PartnerOnboarding>(
    `/api/v1/partners/${partnerId}/onboarding`,
    data
  );
  return response.data;
}

export async function completeOnboardingStage(
  partnerId: string,
  data: OnboardingStageComplete
): Promise<PartnerOnboarding> {
  const response = await api.post<PartnerOnboarding>(
    `/api/v1/partners/${partnerId}/onboarding/complete-stage`,
    data
  );
  return response.data;
}

// ============================================================================
// Full Capability Matrix
// ============================================================================

export async function getCapabilityMatrix(partnerId: string): Promise<CapabilityMatrixResponse> {
  const response = await api.get<CapabilityMatrixResponse>(
    `/api/v1/partners/${partnerId}/capability-matrix`
  );
  return response.data;
}
