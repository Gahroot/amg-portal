import api from "@/lib/api";
import { PartnerProfile } from "./partners";
import { Assignment, AssignmentListResponse } from "./assignments";
import { DeliverableListResponse, DeliverableItem } from "./deliverables";
import type { DocumentListResponse } from "@/types/document";
import type {
  Conversation,
  ConversationListResponse,
  CommunicationListResponse,
  Communication,
} from "@/types/communication";

// Profile
export async function getMyProfile(): Promise<PartnerProfile> {
  const response = await api.get<PartnerProfile>("/api/v1/partner-portal/profile");
  return response.data;
}

// Assignments
export interface AssignmentListParams {
  status?: string;
}

export async function getMyAssignments(params?: AssignmentListParams): Promise<AssignmentListResponse> {
  const response = await api.get<AssignmentListResponse>("/api/v1/partner-portal/assignments", { params });
  return response.data;
}

export async function getMyAssignment(id: string): Promise<Assignment> {
  const response = await api.get<Assignment>(`/api/v1/partner-portal/assignments/${id}`);
  return response.data;
}

// Deliverables
export interface DeliverableListParams {
  status?: string;
  assignment_id?: string;
}

export async function getMyDeliverables(params?: DeliverableListParams): Promise<DeliverableListResponse> {
  const response = await api.get<DeliverableListResponse>("/api/v1/partner-portal/deliverables", { params });
  return response.data;
}

export async function getMyDeliverable(id: string): Promise<DeliverableItem> {
  const response = await api.get<DeliverableItem>(`/api/v1/partner-portal/deliverables/${id}`);
  return response.data;
}

// Documents (brief documents for assignments)
export async function getAssignmentDocuments(assignmentId: string): Promise<DocumentListResponse> {
  const response = await api.get<DocumentListResponse>(
    `/api/v1/partner-portal/assignments/${assignmentId}/documents`
  );
  return response.data;
}

export async function getDocumentDownloadUrl(documentId: string): Promise<{ download_url: string }> {
  const response = await api.get<{ download_url: string }>(
    `/api/v1/partner-portal/documents/${documentId}/download`
  );
  return response.data;
}

// Conversations with coordinators
export async function getMyConversations(params?: { limit?: number }): Promise<ConversationListResponse> {
  const response = await api.get<ConversationListResponse>("/api/v1/partner-portal/conversations", { params });
  return response.data;
}

export async function getMyConversation(conversationId: string): Promise<Conversation> {
  const response = await api.get<Conversation>(`/api/v1/partner-portal/conversations/${conversationId}`);
  return response.data;
}

export async function getConversationMessages(
  conversationId: string,
  params?: { skip?: number; limit?: number }
): Promise<CommunicationListResponse> {
  const response = await api.get<CommunicationListResponse>(
    `/api/v1/partner-portal/conversations/${conversationId}/messages`,
    { params }
  );
  return response.data;
}

export async function sendMessageToConversation(
  conversationId: string,
  body: string
): Promise<Communication> {
  const response = await api.post<Communication>(
    `/api/v1/partner-portal/conversations/${conversationId}/messages`,
    { body }
  );
  return response.data;
}

export async function markConversationAsRead(conversationId: string): Promise<void> {
  await api.post(`/api/v1/partner-portal/conversations/${conversationId}/mark-read`);
}
