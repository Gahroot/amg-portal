import api from "@/lib/api";

export interface Assignment {
  id: string;
  partner_id: string;
  program_id: string;
  assigned_by: string;
  title: string;
  brief: string;
  sla_terms: string | null;
  status: string;
  due_date: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  partner_firm_name: string | null;
  program_title: string | null;
}

export interface AssignmentListResponse {
  assignments: Assignment[];
  total: number;
}

export interface AssignmentListParams {
  skip?: number;
  limit?: number;
  partner_id?: string;
  program_id?: string;
  status?: string;
}

export interface AssignmentCreateData {
  partner_id: string;
  program_id: string;
  title: string;
  brief: string;
  sla_terms?: string;
  due_date?: string;
}

export interface AssignmentUpdateData {
  title?: string;
  brief?: string;
  sla_terms?: string;
  status?: string;
  due_date?: string;
}

export async function listAssignments(params?: AssignmentListParams): Promise<AssignmentListResponse> {
  const response = await api.get<AssignmentListResponse>("/api/v1/assignments/", { params });
  return response.data;
}

export async function getAssignment(id: string): Promise<Assignment> {
  const response = await api.get<Assignment>(`/api/v1/assignments/${id}`);
  return response.data;
}

export async function createAssignment(data: AssignmentCreateData): Promise<Assignment> {
  const response = await api.post<Assignment>("/api/v1/assignments/", data);
  return response.data;
}

export async function updateAssignment(id: string, data: AssignmentUpdateData): Promise<Assignment> {
  const response = await api.patch<Assignment>(`/api/v1/assignments/${id}`, data);
  return response.data;
}

export async function dispatchAssignment(id: string): Promise<Assignment> {
  const response = await api.post<Assignment>(`/api/v1/assignments/${id}/dispatch`);
  return response.data;
}

export async function acceptAssignment(id: string): Promise<Assignment> {
  const response = await api.post<Assignment>(`/api/v1/assignments/${id}/accept`);
  return response.data;
}
