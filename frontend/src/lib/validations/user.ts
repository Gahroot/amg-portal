import { z } from "zod/v4";
import { mfaCodeField, passwordSchema } from "./auth";

// Profile update schema
export const profileUpdateSchema = z.object({
  full_name: z.string().min(1, "Full name is required").max(255),
  phone_number: z.string().optional(),
});

// Password change schema
export const passwordChangeSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: passwordSchema,
    confirm_password: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

// MFA code schema
export const mfaCodeSchema = z.object({
  code: mfaCodeField,
});

// Notification preferences schema
export const notificationPreferencesSchema = z.object({
  digest_enabled: z.boolean(),
  digest_frequency: z.enum(["immediate", "daily", "weekly", "never"]),
  channel_preferences: z.object({
    email: z.boolean(),
    in_portal: z.boolean(),
    push: z.boolean(),
  }),
  notification_type_preferences: z.record(z.string(), z.string()).optional(),
  quiet_hours_enabled: z.boolean(),
  quiet_hours_start: z.string().optional(),
  quiet_hours_end: z.string().optional(),
  timezone: z.string(),
});

// Message digest preferences schema
export const messageDigestPreferencesSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(["immediate", "daily", "weekly", "never"]),
  include_attachments: z.boolean().optional(),
  quiet_hours_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().optional(),
  quiet_hours_end: z.string().optional(),
});

// Type exports
export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
export type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>;
export type MfaCodeFormData = z.infer<typeof mfaCodeSchema>;
export type NotificationPreferencesFormData = z.infer<typeof notificationPreferencesSchema>;
export type MessageDigestPreferencesFormData = z.infer<typeof messageDigestPreferencesSchema>;
