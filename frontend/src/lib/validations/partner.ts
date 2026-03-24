import { z } from "zod/v4";

// Governance action types
export const governanceActionTypeSchema = z.enum([
  "warning",
  "probation",
  "suspension",
  "termination",
  "reinstatement",
]);

// Governance action form schema
export const governanceActionSchema = z.object({
  action: governanceActionTypeSchema,
  reason: z.string().min(1, "Reason is required"),
  expiry_date: z.string().optional(),
});

// Partner certification schema
export const partnerCertificationSchema = z.object({
  name: z.string().min(1, "Certification name is required"),
  issuing_body: z.string().optional(),
  issue_date: z.string().optional(),
  expiry_date: z.string().optional(),
  certificate_number: z.string().optional(),
  verification_status: z.enum(["pending", "verified", "expired", "revoked"]).optional(),
});

// Partner capability schema
export const partnerCapabilitySchema = z.object({
  category: z.string().min(1, "Category is required"),
  capability: z.string().min(1, "Capability is required"),
  rating: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
});

// Performance notice schema
export const performanceNoticeSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  severity: z.enum(["low", "medium", "high", "critical"]),
  action_required: z.string().optional(),
  due_date: z.string().optional(),
});

// Partner onboarding schema
export const partnerOnboardingSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  primary_contact_name: z.string().min(1, "Primary contact name is required"),
  primary_contact_email: z.email("Please enter a valid email address"),
  primary_contact_phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  description: z.string().optional(),
  service_categories: z.array(z.string()).optional(),
  certifications: z.array(partnerCertificationSchema).optional(),
  capabilities: z.array(partnerCapabilitySchema).optional(),
});

// Type exports
export type GovernanceActionType = z.infer<typeof governanceActionTypeSchema>;
export type GovernanceActionFormData = z.infer<typeof governanceActionSchema>;
export type PartnerCertificationFormData = z.infer<typeof partnerCertificationSchema>;
export type PartnerCapabilityFormData = z.infer<typeof partnerCapabilitySchema>;
export type PerformanceNoticeFormData = z.infer<typeof performanceNoticeSchema>;
export type PartnerOnboardingFormData = z.infer<typeof partnerOnboardingSchema>;
