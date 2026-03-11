import api from '@/lib/api';
import type { ClientProfile, ClientProfileListResponse, ClientProfileCreateData, ClientProfileUpdateData, ClientListParams } from '@/types/client';

export async function listClients(params?: ClientListParams): Promise<ClientProfileListResponse> {
  const res = await api.get<ClientProfileListResponse>('/clients', { params });
  return res.data;
}

export async function getClient(id: string): Promise<ClientProfile> {
  const res = await api.get<ClientProfile>(`/clients/${id}`);
  return res.data;
}

export async function createClient(data: ClientProfileCreateData): Promise<ClientProfile> {
  const res = await api.post<ClientProfile>('/clients', data);
  return res.data;
}

export async function updateClient(id: string, data: ClientProfileUpdateData): Promise<ClientProfile> {
  const res = await api.put<ClientProfile>(`/clients/${id}`, data);
  return res.data;
}
