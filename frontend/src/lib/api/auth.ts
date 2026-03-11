import api from "@/lib/api";

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string | null;
  role: string;
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
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
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
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export async function login(
  credentials: LoginCredentials
): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>(
    "/api/v1/auth/login",
    credentials
  );
  return response.data;
}

export async function getCurrentUser(): Promise<User> {
  const response = await api.get<User>("/api/v1/auth/me");
  return response.data;
}

export async function updateProfile(data: ProfileUpdateRequest): Promise<User> {
  const response = await api.patch<User>("/api/v1/auth/me", data);
  return response.data;
}

export async function refreshToken(
  token: string
): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>(
    "/api/v1/auth/refresh",
    {
      refresh_token: token,
    }
  );
  return response.data;
}

export async function setupMFA(): Promise<MFASetupResponse> {
  const response = await api.post<MFASetupResponse>(
    "/api/v1/auth/mfa/setup"
  );
  return response.data;
}

export async function verifyMFASetup(
  code: string
): Promise<{ message: string }> {
  const response = await api.post("/api/v1/auth/mfa/verify-setup", {
    code,
  });
  return response.data;
}

export async function disableMFA(
  code: string
): Promise<{ message: string }> {
  const response = await api.post("/api/v1/auth/mfa/disable", {
    code,
  });
  return response.data;
}

export async function changePassword(
  data: ChangePasswordRequest
): Promise<void> {
  await api.post("/api/v1/auth/change-password", data);
}

export async function getNotificationPreferences(): Promise<UserNotificationPreferences> {
  const response = await api.get<UserNotificationPreferences>("/api/v1/auth/preferences");
  return response.data;
}

export async function updateNotificationPreferences(
  data: UserNotificationPreferencesUpdate
): Promise<UserNotificationPreferences> {
  const response = await api.patch<UserNotificationPreferences>("/api/v1/auth/preferences", data);
  return response.data;
}
