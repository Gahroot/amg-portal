/**
 * Partner capability types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/partner_capability.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

// Capability
export type PartnerCapability = components["schemas"]["CapabilityResponse"];
export type CapabilityCreate = components["schemas"]["CapabilityCreate"];
export type CapabilityUpdate = components["schemas"]["CapabilityUpdate"];
export type CapabilityListResponse = components["schemas"]["CapabilityListResponse"];

// Service Category
export type ServiceCategory = components["schemas"]["ServiceCategoryResponse"];
export type ServiceCategoryListResponse = components["schemas"]["ServiceCategoryListResponse"];
export type ServiceCategoryCreate = components["schemas"]["ServiceCategoryCreate"];
export type ServiceCategoryUpdate = components["schemas"]["ServiceCategoryUpdate"];

// Qualification
export type PartnerQualification = components["schemas"]["QualificationResponse"];
export type QualificationCreate = components["schemas"]["QualificationCreate"];
export type QualificationApproval = components["schemas"]["QualificationApproval"];
export type QualificationListResponse = components["schemas"]["QualificationListResponse"];
export type QualificationLevel = components["schemas"]["QualificationLevel"];

// Certification
export type PartnerCertification = components["schemas"]["CertificationResponse"];
export type CertificationCreate = components["schemas"]["CertificationCreate"];
export type CertificationVerification = components["schemas"]["CertificationVerification"];
export type CertificationListResponse = components["schemas"]["CertificationListResponse"];
export type CertificationStatus = components["schemas"]["CertificationStatus"];

// Onboarding
export type PartnerOnboarding = components["schemas"]["OnboardingResponse"];
export type OnboardingResponse = components["schemas"]["OnboardingResponse"];
export type OnboardingCreate = components["schemas"]["OnboardingCreate"];
export type OnboardingUpdate = components["schemas"]["OnboardingUpdate"];
export type OnboardingStageComplete = components["schemas"]["OnboardingStageComplete"];
export type OnboardingStage = components["schemas"]["OnboardingStage"];

// Full Capability Matrix
export type CapabilityMatrixResponse = components["schemas"]["CapabilityMatrixResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, request shapes, UI constants
// ---------------------------------------------------------------------------

export type ProficiencyLevel = "beginner" | "intermediate" | "expert";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface QualificationUpdate {
  qualification_level?: QualificationLevel;
  notes?: string;
}

export interface CertificationUpdate {
  name?: string;
  issuing_body?: string;
  certificate_number?: string;
  issue_date?: string;
  expiry_date?: string;
  document_url?: string;
  notes?: string;
}

// Stage configuration
export const ONBOARDING_STAGES: { id: OnboardingStage; label: string; description: string }[] = [
  {
    id: "profile_setup",
    label: "Profile Setup",
    description: "Complete firm information, contact details, and geographic coverage",
  },
  {
    id: "capability_matrix",
    label: "Capability Matrix",
    description: "Add skills and proficiency levels",
  },
  {
    id: "compliance_docs",
    label: "Compliance Documents",
    description: "Upload and verify compliance documentation",
  },
  {
    id: "certification_upload",
    label: "Certifications",
    description: "Add professional certifications",
  },
  {
    id: "review",
    label: "Review & Approval",
    description: "Final review and approval by coordinator",
  },
  {
    id: "completed",
    label: "Completed",
    description: "Onboarding complete",
  },
];

export const DEFAULT_CHECKLIST_ITEMS: Record<OnboardingStage, Record<string, string>> = {
  profile_setup: {
    firm_info: "Firm information completed",
    contact_info: "Contact information verified",
    geographies: "Geographic coverage added",
  },
  capability_matrix: {
    capabilities_added: "Capabilities added",
    proficiency_set: "Proficiency levels set",
  },
  compliance_docs: {
    compliance_doc_uploaded: "Compliance document uploaded",
    compliance_verified: "Compliance verified",
  },
  certification_upload: {
    certifications_added: "Certifications added",
    certifications_verified: "Certifications verified",
  },
  review: {
    review_submitted: "Submitted for review",
    review_approved: "Review approved",
  },
  completed: {},
};

export const PROFICIENCY_LABELS: Record<ProficiencyLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  expert: "Expert",
};

export const PROFICIENCY_COLORS: Record<ProficiencyLevel, string> = {
  beginner: "bg-gray-100 text-gray-700",
  intermediate: "bg-blue-100 text-blue-700",
  expert: "bg-green-100 text-green-700",
};

export const QUALIFICATION_LEVEL_LABELS: Record<QualificationLevel, string> = {
  qualified: "Qualified",
  preferred: "Preferred",
  expert: "Expert",
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const APPROVAL_STATUS_COLORS: Record<ApprovalStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export const CERTIFICATION_STATUS_LABELS: Record<CertificationStatus, string> = {
  pending: "Pending",
  verified: "Verified",
  expired: "Expired",
  rejected: "Rejected",
};

export const CERTIFICATION_STATUS_COLORS: Record<CertificationStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  verified: "bg-green-100 text-green-700",
  expired: "bg-gray-100 text-gray-700",
  rejected: "bg-red-100 text-red-700",
};
