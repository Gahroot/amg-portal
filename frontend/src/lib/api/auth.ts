import api from "@/lib/api";
import type {
  User,
  LoginCredentials,
  AuthResponse,
  MFASetupResponse,
  ProfileUpdateRequest,
  UserNotificationPreferences,
  UserNotificationPreferencesUpdate,
  ChangePasswordRequest,
} from "@/types/user";

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
    "/api/v1/auth/mfa/setup",
    {}
  );
  return response.data;
}

export async function verifyMFASetup(code: string): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>(
    "/api/v1/auth/mfa/verify-setup",
    { code }
  );
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

export async function forgotPassword(email: string): Promise<void> {
  await api.post("/api/v1/auth/forgot-password", { email });
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<void> {
  await api.post("/api/v1/auth/reset-password", {
    token,
    new_password: newPassword,
  });
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
