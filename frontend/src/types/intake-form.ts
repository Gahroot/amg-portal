import type { FamilyMember, FamilyMemberCreate } from "./family-member";

export interface IntakeStep1Identity {
  legal_name: string;
  display_name?: string;
  entity_type?: string;
  jurisdiction?: string;
  tax_id?: string;
}

export interface IntakeStep2Contact {
  primary_email: string;
  secondary_email?: string;
  phone?: string;
  address?: string;
}

export interface IntakeStep3Preferences {
  communication_preference?: string;
  sensitivities?: string;
  special_instructions?: string;
}

export interface IntakeStep4Lifestyle {
  travel_preferences?: string;
  dietary_restrictions?: string;
  interests?: string;
  preferred_destinations?: string[];
  language_preference?: string;
}

export interface IntakeFormData
  extends IntakeStep1Identity,
    IntakeStep2Contact,
    IntakeStep3Preferences {
  // Step 4
  travel_preferences?: string;
  dietary_restrictions?: string;
  interests?: string;
  preferred_destinations?: string[];
  language_preference?: string;

  // Step 5
  family_members?: FamilyMemberCreate[];
}

export interface IntakeDraftData extends Partial<IntakeFormData> {}

export interface IntakeFormResponse {
  id: string;
  legal_name: string;
  display_name: string | null;
  entity_type: string | null;
  jurisdiction: string | null;
  tax_id: string | null;
  primary_email: string;
  secondary_email: string | null;
  phone: string | null;
  address: string | null;
  communication_preference: string | null;
  sensitivities: string | null;
  special_instructions: string | null;
  compliance_status: string;
  approval_status: string;
  intelligence_file: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  family_members: FamilyMember[];
  lifestyle: IntakeStep4Lifestyle | null;
}

export const ENTITY_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "corporation", label: "Corporation" },
  { value: "trust", label: "Trust" },
  { value: "partnership", label: "Partnership" },
  { value: "foundation", label: "Foundation" },
  { value: "family_office", label: "Family Office" },
  { value: "other", label: "Other" },
] as const;

export const COMMUNICATION_PREFS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "in_person", label: "In Person" },
  { value: "portal", label: "Portal" },
  { value: "video_call", label: "Video Call" },
] as const;

export const FAMILY_RELATIONSHIP_TYPES = [
  { value: "spouse", label: "Spouse" },
  { value: "partner", label: "Partner" },
  { value: "child", label: "Child" },
  { value: "parent", label: "Parent" },
  { value: "sibling", label: "Sibling" },
  { value: "grandparent", label: "Grandparent" },
  { value: "grandchild", label: "Grandchild" },
  { value: "aunt_uncle", label: "Aunt/Uncle" },
  { value: "cousin", label: "Cousin" },
  { value: "in_law", label: "In-Law" },
  { value: "other", label: "Other" },
] as const;

export const LANGUAGE_OPTIONS = [
  { value: "english", label: "English" },
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "mandarin", label: "Mandarin" },
  { value: "japanese", label: "Japanese" },
  { value: "arabic", label: "Arabic" },
  { value: "portuguese", label: "Portuguese" },
  { value: "italian", label: "Italian" },
  { value: "other", label: "Other" },
] as const;
