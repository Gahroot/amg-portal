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

// ============================================================================
// Class C Partner Reports
// ============================================================================

export interface ActiveBriefDeliverable {
  id: string;
  title: string;
  deliverable_type: string;
  description: string | null;
  due_date: string | null;
  status: string;
}

export interface ActiveBriefEntry {
  id: string;
  title: string;
  brief: string;
  sla_terms: string | null;
  status: string;
  due_date: string | null;
  program_title: string | null;
  accepted_at: string | null;
  created_at: string;
  deliverables: ActiveBriefDeliverable[];
}

export interface ActiveBriefSummaryReport {
  assignments: ActiveBriefEntry[];
  total_assignments: number;
  total_deliverables: number;
  pending_deliverables: number;
  generated_at: string;
}

export interface DeliverableFeedbackEntry {
  id: string;
  assignment_id: string;
  assignment_title: string;
  title: string;
  deliverable_type: string;
  status: string;
  due_date: string | null;
  submitted_at: string | null;
  review_comments: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
}

export interface DeliverableFeedbackReport {
  deliverables: DeliverableFeedbackEntry[];
  total: number;
  reviewed_count: number;
  pending_count: number;
  approved_count: number;
  returned_count: number;
  generated_at: string;
}

export interface EngagementRating {
  quality_score: number;
  timeliness_score: number;
  communication_score: number;
  overall_score: number;
}

export interface EngagementHistoryEntry {
  id: string;
  title: string;
  program_title: string | null;
  status: string;
  due_date: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
  rating: EngagementRating | null;
}

export interface EngagementHistoryStats {
  total_engagements: number;
  completed_engagements: number;
  completion_rate: number;
  average_quality: number | null;
  average_timeliness: number | null;
  average_communication: number | null;
  average_overall: number | null;
}

export interface EngagementHistoryReport {
  engagements: EngagementHistoryEntry[];
  stats: EngagementHistoryStats;
  generated_at: string;
}

export async function getActiveBriefSummary(): Promise<ActiveBriefSummaryReport> {
  const response = await api.get<ActiveBriefSummaryReport>(
    "/api/v1/partner-portal/reports/active-brief",
  );
  return response.data;
}

export async function getDeliverableFeedback(params?: {
  assignment_id?: string;
}): Promise<DeliverableFeedbackReport> {
  const response = await api.get<DeliverableFeedbackReport>(
    "/api/v1/partner-portal/reports/deliverable-feedback",
    { params },
  );
  return response.data;
}

export async function exportDeliverableFeedback(params?: {
  assignment_id?: string;
}): Promise<void> {
  const response = await api.get(
    "/api/v1/partner-portal/reports/deliverable-feedback/export",
    { params, responseType: "blob" },
  );
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `deliverable_feedback_${new Date().toISOString().split("T")[0]}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function getEngagementHistory(): Promise<EngagementHistoryReport> {
  const response = await api.get<EngagementHistoryReport>(
    "/api/v1/partner-portal/reports/engagement-history",
  );
  return response.data;
}

export async function exportEngagementHistory(): Promise<void> {
  const response = await api.get(
    "/api/v1/partner-portal/reports/engagement-history/export",
    { responseType: "blob" },
  );
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `engagement_history_${new Date().toISOString().split("T")[0]}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
