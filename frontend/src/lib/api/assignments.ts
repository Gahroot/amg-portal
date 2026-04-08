import api from "@/lib/api";
import { createApiClient } from "./factory";

export interface AssignmentHistoryEntry {
  id: string;
  assignment_id: string;
  actor_id: string;
  event: string;
  reason: string | null;
  created_at: string;
}

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
  offer_expires_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  created_at: string;
  updated_at: string;
  brief_pdf_path: string | null;
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
  search?: string;
}

export interface AssignmentCreateData {
  partner_id: string;
  program_id: string;
  title: string;
  brief: string;
  sla_terms?: string;
  due_date?: string;
  offer_hours?: number;
}

export interface AssignmentUpdateData {
  title?: string;
  brief?: string;
  sla_terms?: string;
  status?: string;
  due_date?: string;
}

const assignmentsApi = createApiClient<
  Assignment,
  AssignmentListResponse,
  AssignmentCreateData,
  AssignmentUpdateData
>("/api/v1/assignments/");

export const listAssignments = assignmentsApi.list as (
  params?: AssignmentListParams,
) => Promise<AssignmentListResponse>;
export const getAssignment = assignmentsApi.get;
export const createAssignment = assignmentsApi.create;
export const updateAssignment = assignmentsApi.update;

// Custom endpoints

export async function dispatchAssignment(id: string, offerHours = 48): Promise<Assignment> {
  const response = await api.post<Assignment>(
    `/api/v1/assignments/${id}/dispatch`,
    null,
    { params: { offer_hours: offerHours } },
  );
  return response.data;
}

export async function acceptAssignment(id: string): Promise<Assignment> {
  const response = await api.post<Assignment>(
    `/api/v1/partner-portal/assignments/${id}/accept`,
  );
  return response.data;
}

export async function declineAssignment(id: string, reason: string): Promise<Assignment> {
  const response = await api.post<Assignment>(
    `/api/v1/partner-portal/assignments/${id}/decline`,
    { reason },
  );
  return response.data;
}

export async function getAssignmentHistory(id: string): Promise<AssignmentHistoryEntry[]> {
  const response = await api.get<AssignmentHistoryEntry[]>(
    `/api/v1/partner-portal/assignments/${id}/history`,
  );
  return response.data;
}
