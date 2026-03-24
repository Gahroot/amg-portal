import api from "@/lib/api";
import type { DocumentItem, DocumentListResponse } from "@/types/document";

// ─── Client Preferences ───────────────────────────────────────────────────

export interface ClientPreferences {
  digest_frequency: string | null;
  report_format: string | null;
  notification_channels: Record<string, boolean> | null;
}

export interface ClientPreferencesUpdate {
  digest_frequency?: string | null;
  report_format?: string | null;
  notification_channels?: Record<string, boolean> | null;
}

export async function getClientPreferences(): Promise<ClientPreferences> {
  const response = await api.get<ClientPreferences>("/api/v1/portal/preferences");
  return response.data;
}

export async function updateClientPreferences(
  data: ClientPreferencesUpdate,
): Promise<ClientPreferences> {
  const response = await api.patch<ClientPreferences>("/api/v1/portal/preferences", data);
  return response.data;
}

export interface ClientPortalProgram {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  milestone_count: number;
  completed_milestone_count: number;
  rag_status: "green" | "amber" | "red";
}

export interface ClientPortalMilestone {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  position: number;
}

export interface ClientPortalProgramDetail extends ClientPortalProgram {
  objectives: string | null;
  scope: string | null;
  milestones: ClientPortalMilestone[];
}

export interface ClientPortalCommunication {
  id: string;
  title: string | null;
  conversation_type: string;
  last_activity_at: string | null;
  created_at: string;
}

export async function getMyPortalPrograms(): Promise<ClientPortalProgram[]> {
  const response = await api.get<ClientPortalProgram[]>("/api/v1/portal/programs");
  return response.data;
}

export async function getMyPortalProgram(id: string): Promise<ClientPortalProgramDetail> {
  const response = await api.get<ClientPortalProgramDetail>(`/api/v1/portal/programs/${id}`);
  return response.data;
}

export async function getMyPortalCommunications(): Promise<ClientPortalCommunication[]> {
  const response = await api.get<ClientPortalCommunication[]>("/api/v1/portal/communications");
  return response.data;
}

export async function getMyPortalDocuments(): Promise<DocumentListResponse> {
  const response = await api.get<DocumentListResponse>("/api/v1/portal/documents");
  return response.data;
}

export async function getMyPortalDocument(id: string): Promise<DocumentItem> {
  const response = await api.get<DocumentItem>(`/api/v1/portal/documents/${id}`);
  return response.data;
}

export interface AcknowledgmentResponse {
  id: string;
  document_id: string;
  user_id: string;
  signer_name: string;
  acknowledged_at: string;
}

// ─── Milestone Calendar ───────────────────────────────────────────────────

export interface CalendarMilestone {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  position: number;
  program_id: string;
  program_title: string;
  program_status: string;
}

export interface GetMyMilestonesParams {
  program_id?: string;
  upcoming_only?: boolean;
}

export async function getMyPortalMilestones(
  params?: GetMyMilestonesParams,
): Promise<CalendarMilestone[]> {
  const response = await api.get<CalendarMilestone[]>("/api/v1/portal/milestones", { params });
  return response.data;
}

export async function acknowledgePortalDocument(
  documentId: string,
  signerName: string,
): Promise<AcknowledgmentResponse> {
  const response = await api.post<AcknowledgmentResponse>(
    `/api/v1/portal/documents/${documentId}/acknowledge`,
    { signer_name: signerName },
  );
  return response.data;
}

// ─── Decision History Archive ────────────────────────────────────────────────

export interface DecisionHistoryItem {
  id: string;
  title: string;
  prompt: string;
  response_type: string;
  options: Array<{ id: string; label: string; description?: string }> | null;
  deadline_date: string | null;
  deadline_time: string | null;
  consequence_text: string | null;
  status: string;
  response: {
    option_id?: string;
    text?: string;
    responded_at?: string;
  } | null;
  responded_at: string | null;
  program_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DecisionHistoryResponse {
  decisions: DecisionHistoryItem[];
  total: number;
}

export interface DecisionHistoryParams {
  status?: string;
  program_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

export async function getMyDecisionHistory(
  params: DecisionHistoryParams = {},
): Promise<DecisionHistoryResponse> {
  const response = await api.get<DecisionHistoryResponse>(
    "/api/v1/portal/decisions/history",
    { params },
  );
  return response.data;
}

export function buildDecisionHistoryExportUrl(
  params: Omit<DecisionHistoryParams, "skip" | "limit"> & { format?: "csv" | "xlsx" },
): string {
  const base = "/api/v1/portal/decisions/history/export";
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.program_id) qs.set("program_id", params.program_id);
  if (params.date_from) qs.set("date_from", params.date_from);
  if (params.date_to) qs.set("date_to", params.date_to);
  if (params.search) qs.set("search", params.search);
  if (params.format) qs.set("format", params.format);
  const str = qs.toString();
  return str ? `${base}?${str}` : base;
}

// ─── What's New Feed ──────────────────────────────────────────────────────────

export type UpdateType =
  | "program_status"
  | "milestone_completed"
  | "document_delivered"
  | "message_received"
  | "decision_resolved";

export interface FeedItem {
  id: string;
  update_type: UpdateType;
  title: string;
  description: string;
  program_id: string | null;
  program_title: string | null;
  timestamp: string;
  link: string;
  is_read: boolean;
}

export interface FeedResponse {
  items: FeedItem[];
  total: number;
  unread_count: number;
  skip: number;
  limit: number;
}

export interface GetUpdatesParams {
  update_type?: UpdateType;
  program_id?: string;
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
}

export async function getPortalUpdates(params: GetUpdatesParams = {}): Promise<FeedResponse> {
  const response = await api.get<FeedResponse>("/api/v1/portal/updates", { params });
  return response.data;
}

export async function getPortalUpdatesUnreadCount(): Promise<number> {
  const response = await api.get<{ unread_count: number }>("/api/v1/portal/updates/unread-count");
  return response.data.unread_count;
}

export async function markPortalUpdatesAllRead(): Promise<void> {
  await api.post("/api/v1/portal/updates/mark-all-read");
}
