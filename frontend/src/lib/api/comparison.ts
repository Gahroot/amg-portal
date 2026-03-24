import api from "@/lib/api";
import type { ProgramDetail } from "@/types/program";
import type { ClientProfile } from "@/types/client";

export async function comparePrograms(ids: string[]): Promise<ProgramDetail[]> {
  const response = await api.post<ProgramDetail[]>("/api/v1/programs/compare", ids);
  return response.data;
}

export async function compareClients(ids: string[]): Promise<ClientProfile[]> {
  const response = await api.post<ClientProfile[]>("/api/v1/clients/compare", ids);
  return response.data;
}
