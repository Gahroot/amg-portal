import api from "@/lib/api";
import type { User } from "./auth";

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

export async function listUsers(
  params?: UserListParams
): Promise<UserListResponse> {
  const response = await api.get<UserListResponse>("/api/v1/users/", {
    params,
  });
  return response.data;
}

export async function createUser(data: UserCreateData): Promise<User> {
  const response = await api.post<User>("/api/v1/users/", data);
  return response.data;
}

export async function getUser(id: string): Promise<User> {
  const response = await api.get<User>(`/api/v1/users/${id}`);
  return response.data;
}

export async function updateUser(
  id: string,
  data: UserUpdateData
): Promise<User> {
  const response = await api.patch<User>(`/api/v1/users/${id}`, data);
  return response.data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/api/v1/users/${id}`);
}
