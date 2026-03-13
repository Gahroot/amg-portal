/**
 * Types for partner capability matrix, qualifications, certifications, and onboarding.
 */

// Enums
export type ProficiencyLevel = "beginner" | "intermediate" | "expert";
export type QualificationLevel = "qualified" | "preferred" | "expert";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type CertificationStatus = "pending" | "verified" | "expired" | "rejected";
export type OnboardingStage =
  | "profile_setup"
  | "capability_matrix"
  | "compliance_docs"
  | "certification_upload"
  | "review"
  | "completed";

// Capability
export interface PartnerCapability {
  id: string;
  partner_id: string;
  capability_name: string;
  proficiency_level: ProficiencyLevel;
  years_experience: number | null;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CapabilityCreate {
  capability_name: string;
  proficiency_level: ProficiencyLevel;
  years_experience?: number;
  notes?: string;
}

export interface CapabilityUpdate {
  capability_name?: string;
  proficiency_level?: ProficiencyLevel;
  years_experience?: number;
  notes?: string;
}

export interface CapabilityListResponse {
  capabilities: PartnerCapability[];
  total: number;
}

// Service Category
export interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  required_capabilities: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceCategoryCreate {
  name: string;
  description?: string;
  required_capabilities?: string[];
}

export interface ServiceCategoryUpdate {
  name?: string;
  description?: string;
  required_capabilities?: string[];
  active?: boolean;
}

export interface ServiceCategoryListResponse {
  categories: ServiceCategory[];
  total: number;
}

// Qualification
export interface PartnerQualification {
  id: string;
  partner_id: string;
  category_id: string;
  category_name: string | null;
  qualification_level: QualificationLevel;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface QualificationCreate {
  category_id: string;
  qualification_level: QualificationLevel;
  notes?: string;
}

export interface QualificationUpdate {
  qualification_level?: QualificationLevel;
  notes?: string;
}

export interface QualificationApproval {
  status: ApprovalStatus;
  notes?: string;
}

export interface QualificationListResponse {
  qualifications: PartnerQualification[];
  total: number;
}

// Certification
export interface PartnerCertification {
  id: string;
  partner_id: string;
  name: string;
  issuing_body: string;
  certificate_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  document_url: string | null;
  verification_status: CertificationStatus;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_expired: boolean;
  is_expiring_soon: boolean;
}

export interface CertificationCreate {
  name: string;
  issuing_body: string;
  certificate_number?: string;
  issue_date?: string;
  expiry_date?: string;
  document_url?: string;
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

export interface CertificationVerification {
  status: CertificationStatus;
  notes?: string;
}

export interface CertificationListResponse {
  certifications: PartnerCertification[];
  total: number;
}

// Onboarding
export type OnboardingResponse = PartnerOnboarding;

export interface PartnerOnboarding {
  id: string;
  partner_id: string;
  current_stage: OnboardingStage;
  checklist_items: Record<string, Record<string, boolean>>;
  completed_stages: string[];
  assigned_coordinator: string | null;
  coordinator_name: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  progress_percentage: number;
}

export interface OnboardingCreate {
  assigned_coordinator?: string;
}

export interface OnboardingUpdate {
  current_stage?: OnboardingStage;
  checklist_items?: Record<string, Record<string, boolean>>;
  completed_stages?: string[];
  assigned_coordinator?: string;
}

export interface OnboardingStageComplete {
  stage: OnboardingStage;
  checklist_items?: Record<string, boolean>;
}

// Full Capability Matrix
export interface CapabilityMatrixResponse {
  partner_id: string;
  firm_name: string;
  capabilities: PartnerCapability[];
  qualifications: PartnerQualification[];
  certifications: PartnerCertification[];
  onboarding: PartnerOnboarding | null;
  capability_summary: Record<string, number>;
  qualification_summary: Record<string, number>;
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

// Default checklist items per stage
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

// Proficiency level display helpers
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
