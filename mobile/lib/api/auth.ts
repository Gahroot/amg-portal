import api from '@/lib/api';
import type { User } from '@/types/user';

interface LoginRequest {
  email: string;
  password: string;
  mfa_code?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  mfa_required: boolean;
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

export interface MFASetupResponse {
  secret: string;
  qr_code_uri: string;
  backup_codes: string[];
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post('/auth/reset-password', { token, password });
}

export async function setupMFA(): Promise<MFASetupResponse> {
  const res = await api.post<MFASetupResponse>('/auth/mfa/setup');
  return res.data;
}

export async function verifyMFASetup(code: string): Promise<{ success: boolean }> {
  const res = await api.post<{ success: boolean }>('/auth/mfa/setup/verify', { code });
  return res.data;
}
