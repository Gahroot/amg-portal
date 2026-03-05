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
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
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

export async function refreshToken(token: string): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/api/v1/auth/refresh", {
    refresh_token: token,
  });
  return response.data;
}
