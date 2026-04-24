/**
 * Client intake form types — re-exported from generated OpenAPI types where possible.
 *
 * API types are sourced from generated.ts (auto-generated from FastAPI OpenAPI schema).
 * Frontend-only types (wizard option lists) remain manual.
 *
 * To refresh: npm run generate:types (requires backend at localhost:8000)
 *
 * @see backend/app/schemas/intake_form.py
 *
 * Note: the wizard's form-state type (`IntakeFormData`) is Zod-inferred from
 * `src/lib/validations/client.ts`, not re-exported here.
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type IntakeDraftData = components["schemas"]["IntakeDraftData"];
export type IntakeFormResponse = components["schemas"]["IntakeFormResponse"];
export type IntakeStep4Lifestyle = components["schemas"]["IntakeStep4Lifestyle"];

// ---------------------------------------------------------------------------
// Frontend-only types — wizard option lists
// ---------------------------------------------------------------------------

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
