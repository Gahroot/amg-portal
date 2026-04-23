import { z } from "zod/v4";

// Lead form schema
export const leadSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(255),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  company: z.string().max(255).optional(),
  status: z.enum([
    "new",
    "contacting",
    "qualifying",
    "qualified",
    "disqualified",
    "converted",
  ] as const),
  source: z.enum([
    "referral_partner",
    "existing_client",
    "inbound_web",
    "outbound",
    "event",
    "other",
  ] as const),
  source_details: z.string().max(500).optional(),
  estimated_value: z.string().optional(),
  estimated_client_type: z
    .enum(["uhnw_individual", "family_office", "global_executive"] as const)
    .optional(),
  notes: z.string().optional(),
});

// Lead convert form schema
export const leadConvertSchema = z.object({
  legal_name: z.string().min(1, "Legal name is required"),
  primary_email: z.email("Valid email required"),
  entity_type: z.enum([
    "uhnw_individual",
    "family_office",
    "global_executive",
  ] as const),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

// Type exports
export type LeadFormValues = z.infer<typeof leadSchema>;
export type LeadConvertFormValues = z.infer<typeof leadConvertSchema>;
