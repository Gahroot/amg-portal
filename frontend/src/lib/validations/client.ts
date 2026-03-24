import { z } from "zod/v4";

// Step 1 - Identity
export const clientIdentitySchema = z.object({
  legal_name: z.string().min(1, "Legal name is required"),
  display_name: z.string().optional(),
  entity_type: z.string().optional(),
  jurisdiction: z.string().optional(),
  tax_id: z.string().optional(),
});

// Step 2 - Contact
export const clientContactSchema = z.object({
  primary_email: z.email("Please enter a valid email address"),
  secondary_email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

// Step 3 - Preferences
export const clientPreferencesSchema = z.object({
  communication_preference: z.string().optional(),
  sensitivities: z.string().optional(),
  special_instructions: z.string().optional(),
});

// Step 4 - Lifestyle
export const clientLifestyleSchema = z.object({
  travel_preferences: z.string().optional(),
  dietary_restrictions: z.string().optional(),
  interests: z.string().optional(),
  preferred_destinations: z.array(z.string()).optional(),
  language_preference: z.string().optional(),
});

// Family member schema (aligned with API)
export const familyMemberSchema = z.object({
  name: z.string().min(1, "Family member name is required"),
  relationship_type: z.enum([
    "spouse",
    "partner",
    "child",
    "parent",
    "sibling",
    "grandparent",
    "grandchild",
    "aunt_uncle",
    "cousin",
    "in_law",
    "other",
  ]),
  date_of_birth: z.string().optional(),
  occupation: z.string().optional(),
  notes: z.string().optional(),
  is_primary_contact: z.boolean().optional(),
});

// Full intake form schema
export const intakeFormSchema = clientIdentitySchema
  .merge(clientContactSchema)
  .merge(clientPreferencesSchema)
  .merge(clientLifestyleSchema)
  .extend({
    family_members: z.array(familyMemberSchema).optional(),
  });

// For creating/updating client profiles
export const clientCreateSchema = intakeFormSchema;

export const clientUpdateSchema = intakeFormSchema.partial();

// Type exports
export type ClientIdentityFormData = z.infer<typeof clientIdentitySchema>;
export type ClientContactFormData = z.infer<typeof clientContactSchema>;
export type ClientPreferencesFormData = z.infer<typeof clientPreferencesSchema>;
export type ClientLifestyleFormData = z.infer<typeof clientLifestyleSchema>;
export type FamilyMemberFormData = z.infer<typeof familyMemberSchema>;
export type IntakeFormData = z.infer<typeof intakeFormSchema>;
export type ClientCreateFormData = z.infer<typeof clientCreateSchema>;
export type ClientUpdateFormData = z.infer<typeof clientUpdateSchema>;
