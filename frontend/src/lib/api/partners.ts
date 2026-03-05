import api from "@/lib/api";

export interface PartnerProfile {
  id: string;
  user_id: string | null;
  firm_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  capabilities: string[];
  geographies: string[];
  availability_status: string;
  performance_rating: number | null;
  total_assignments: number;
  completed_assignments: number;
  compliance_doc_url: string | null;
  compliance_verified: boolean;
  notes: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PartnerListResponse {
  profiles: PartnerProfile[];
  total: number;
}

export interface PartnerListParams {
  skip?: number;
  limit?: number;
  capability?: string;
  geography?: string;
  availability?: string;
  status?: string;
  search?: string;
}

export interface PartnerCreateData {
  firm_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  capabilities: string[];
  geographies: string[];
  notes?: string;
}

export interface PartnerUpdateData {
  firm_name?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  capabilities?: string[];
  geographies?: string[];
  availability_status?: string;
  compliance_verified?: boolean;
  notes?: string;
  status?: string;
}

export interface PartnerProvisionData {
  password?: string;
  send_welcome_email?: boolean;
}

export async function listPartners(params?: PartnerListParams): Promise<PartnerListResponse> {
  const response = await api.get<PartnerListResponse>("/api/v1/partners/", { params });
  return response.data;
}

export async function getPartner(id: string): Promise<PartnerProfile> {
  const response = await api.get<PartnerProfile>(`/api/v1/partners/${id}`);
  return response.data;
}

export async function createPartner(data: PartnerCreateData): Promise<PartnerProfile> {
  const response = await api.post<PartnerProfile>("/api/v1/partners/", data);
  return response.data;
}

export async function updatePartner(id: string, data: PartnerUpdateData): Promise<PartnerProfile> {
  const response = await api.patch<PartnerProfile>(`/api/v1/partners/${id}`, data);
  return response.data;
}

export async function provisionPartner(id: string, data: PartnerProvisionData): Promise<PartnerProfile> {
  const response = await api.post<PartnerProfile>(`/api/v1/partners/${id}/provision`, data);
  return response.data;
}

export async function uploadComplianceDoc(id: string, file: File): Promise<PartnerProfile> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<PartnerProfile>(`/api/v1/partners/${id}/compliance-doc`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}
