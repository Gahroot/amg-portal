/**
 * User types - manually maintained.
 *
 * MIGRATION NOTE:
 *   Types in this file should gradually migrate to src/types/generated.ts
 *   which is auto-generated from the FastAPI OpenAPI schema.
 *
 *   Run `npm run generate:types` to update generated types.
 *   Then re-export from generated.ts:
 *     export type User = components["schemas"]["User"];
 *
 *   Keep frontend-specific extensions (UI state, computed fields) here.
 *
 * Source of truth: backend/app/models/enums.py — UserRole StrEnum
 * Keep in sync when roles are added or renamed.
 *
 * @see backend/app/models/enums.py
 */
export type UserRole =
  | 'managing_director'
  | 'relationship_manager'
  | 'coordinator'
  | 'finance_compliance'
  | 'client'
  | 'partner';

/** Internal (AMG staff) roles */
export const INTERNAL_ROLES: UserRole[] = [
  'managing_director',
  'relationship_manager',
  'coordinator',
  'finance_compliance',
];

/** All valid user roles */
export const ALL_ROLES: UserRole[] = [
  'managing_director',
  'relationship_manager',
  'coordinator',
  'finance_compliance',
  'client',
  'partner',
];

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string | null;
  role: UserRole;
  status: string;
  mfa_enabled: boolean;
  created_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  mfa_code?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  mfa_required: boolean;
  mfa_setup_required: boolean;
  mfa_setup_token: string | null;
}

export interface MFASetupResponse {
  secret: string;
  provisioning_uri: string;
  qr_code_base64: string;
  backup_codes: string[];
}

export interface MFAVerifyRequest {
  code: string;
}

export interface ProfileUpdateRequest {
  full_name?: string;
  phone_number?: string;
}

export interface UserNotificationPreferences {
  digest_enabled: boolean;
  digest_frequency: string;
  notification_type_preferences: Record<string, string> | null;
  channel_preferences: Record<string, boolean> | null;
  granular_preferences?: Record<string, Record<string, boolean>> | null;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
  // Milestone reminder preferences
  milestone_reminder_days: number[] | null;
  milestone_reminder_channels: string[] | null;
  milestone_reminder_program_overrides: Record<string, MilestoneReminderOverride> | null;
}

export interface MilestoneReminderOverride {
  days?: number[];
  channels?: string[];
}

export interface UserNotificationPreferencesUpdate {
  digest_enabled?: boolean;
  digest_frequency?: string;
  notification_type_preferences?: Record<string, string>;
  channel_preferences?: Record<string, boolean>;
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  timezone?: string;
  granular_preferences?: Record<string, Record<string, boolean>>;
  // Milestone reminder preferences
  milestone_reminder_days?: number[];
  milestone_reminder_channels?: string[];
  milestone_reminder_program_overrides?: Record<string, MilestoneReminderOverride>;
}

export interface UserNotificationPreferencesGranular {
  granular_preferences?: Record<string, Record<string, boolean>>;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface UserCreateData {
  email: string;
  password: string;
  full_name: string;
  role: string;
  phone_number?: string;
}

export interface UserUpdateData {
  full_name?: string;
  role?: string;
  status?: string;
  phone_number?: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
}

export interface UserListParams {
  role?: string;
  status?: string;
  search?: string;
  skip?: number;
  limit?: number;
}
