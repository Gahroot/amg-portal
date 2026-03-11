import api from '@/lib/api';
import type { User } from '@/types/user';

export interface LoginRequest {
  email: string;
  password: string;
  mfa_code?: string;
}

export interface TokenResponse {
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

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>('/auth/login', data);
  return res.data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function refreshToken(refresh_token: string): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>('/auth/refresh', { refresh_token });
  return res.data;
}

export async function verifyMFA(code: string): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>('/auth/mfa/verify', { code });
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await api.get<User>('/auth/me');
  return res.data;
}

export async function setupMFA(): Promise<MFASetupResponse> {
  const res = await api.post<MFASetupResponse>('/auth/mfa/setup');
  return res.data;
}

export async function verifyMFASetup(code: string): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>('/auth/mfa/verify-setup', { code });
  return res.data;
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>('/auth/forgot-password', { email });
  return res.data;
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>('/auth/reset-password', { token, password });
  return res.data;
}
