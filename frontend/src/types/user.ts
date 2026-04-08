/**
 * User types — re-exported from generated OpenAPI types where possible.
 *
 * API types are sourced from generated.ts (auto-generated from FastAPI OpenAPI schema).
 * Frontend-only types (UI state, constants, query params) remain manual.
 *
 * To refresh: npm run generate:types (requires backend at localhost:8000)
 *
 * @see backend/app/schemas/user.py
 * @see backend/app/schemas/auth.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type UserRole = components["schemas"]["UserRole"];
export type User = components["schemas"]["UserResponse"];
export type AuthResponse = components["schemas"]["Token"];
export type LoginCredentials = components["schemas"]["LoginRequest"];
export type MFASetupResponse = components["schemas"]["MFASetupResponse"];
export type MFAVerifyRequest = components["schemas"]["MFAVerifyRequest"];
export type ProfileUpdateRequest = components["schemas"]["ProfileUpdateRequest"];
export type UserNotificationPreferences = components["schemas"]["UserNotificationPreferencesResponse"];
export type UserNotificationPreferencesUpdate = components["schemas"]["UserNotificationPreferencesUpdate"];
export type UserCreateData = components["schemas"]["UserCreateByAdmin"];
export type UserUpdateData = components["schemas"]["UserUpdate"];
export type UserListResponse = components["schemas"]["UserListResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — constants, query params, UI helpers
// ---------------------------------------------------------------------------

/** Internal (AMG staff) roles */
export const INTERNAL_ROLES: UserRole[] = [
  "managing_director",
  "relationship_manager",
  "coordinator",
  "finance_compliance",
];

/** All valid user roles */
export const ALL_ROLES: UserRole[] = [
  "managing_director",
  "relationship_manager",
  "coordinator",
  "finance_compliance",
  "client",
  "partner",
];

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface UserListParams {
  role?: string;
  status?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface MilestoneReminderOverride {
  days?: number[];
  channels?: string[];
}

export interface UserNotificationPreferencesGranular {
  granular_preferences?: Record<string, Record<string, boolean>>;
}
