import api from '@/lib/api';
import type { Program, ProgramDetail, ProgramListResponse, ProgramCreateData, ProgramUpdateData } from '@/types/program';

export async function listPrograms(params?: { client_id?: string; status?: string; skip?: number; limit?: number }): Promise<ProgramListResponse> {
  const res = await api.get<ProgramListResponse>('/programs', { params });
  return res.data;
}

export async function getProgram(id: string): Promise<ProgramDetail> {
  const res = await api.get<ProgramDetail>(`/programs/${id}`);
  return res.data;
}

export async function createProgram(data: ProgramCreateData): Promise<Program> {
  const res = await api.post<Program>('/programs', data);
  return res.data;
}

export async function updateProgram(id: string, data: ProgramUpdateData): Promise<Program> {
  const res = await api.put<Program>(`/programs/${id}`, data);
  return res.data;
}
