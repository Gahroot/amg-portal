import { z } from "zod/v4";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

// Raw field (not wrapped in an object) — used inside mfaSetupSchema, mfaDisableSchema, mfaCodeSchema
export const mfaCodeField = z
  .string()
  .min(6, "Code must be at least 6 characters")
  .max(8);

// Login form schema
export const loginSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  mfa_code: z.string().optional(),
});

// Forgot password schema
export const forgotPasswordSchema = z.object({
  email: z.email("Please enter a valid email address"),
});

// Reset password schema
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    password: passwordSchema,
    confirm_password: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

// MFA setup schema
export const mfaSetupSchema = z.object({
  code: mfaCodeField,
});

// MFA disable schema
export const mfaDisableSchema = z.object({
  code: mfaCodeField,
});

// Type exports
export type LoginFormData = z.infer<typeof loginSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type MfaSetupFormData = z.infer<typeof mfaSetupSchema>;
export type MfaDisableFormData = z.infer<typeof mfaDisableSchema>;
