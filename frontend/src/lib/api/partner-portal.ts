import api from "@/lib/api";
import { PartnerProfile } from "./partners";
import { Assignment, AssignmentListResponse } from "./assignments";
import { DeliverableListResponse } from "./deliverables";

export async function getMyProfile(): Promise<PartnerProfile> {
  const response = await api.get<PartnerProfile>("/api/v1/partner-portal/profile");
  return response.data;
}

export async function getMyAssignments(): Promise<AssignmentListResponse> {
  const response = await api.get<AssignmentListResponse>("/api/v1/partner-portal/assignments");
  return response.data;
}

export async function getMyAssignment(id: string): Promise<Assignment> {
  const response = await api.get<Assignment>(`/api/v1/partner-portal/assignments/${id}`);
  return response.data;
}

export async function getMyDeliverables(): Promise<DeliverableListResponse> {
  const response = await api.get<DeliverableListResponse>("/api/v1/partner-portal/deliverables");
  return response.data;
}
