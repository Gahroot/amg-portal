import api from "@/lib/api";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
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
