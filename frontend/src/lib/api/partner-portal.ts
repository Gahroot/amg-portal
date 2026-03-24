import api from "@/lib/api";
import type { PartnerProfile } from "./partners";
import type { Assignment, AssignmentListResponse } from "./assignments";
import type { DeliverableListResponse, DeliverableItem } from "./deliverables";
import type { DocumentListResponse } from "@/types/document";
import type {
  Conversation,
  ConversationListResponse,
  CommunicationListResponse,
  Communication,
} from "@/types/communication";
import type {
  PartnerBriefSummaryReport,
  PartnerDeliverableFeedbackReport,
  PartnerEngagementHistoryReport,
} from "@/types/report";
import type {
  CapabilityRefreshStatus,
  CapabilityRefreshRequest,
} from "@/types/partner";

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

// Partner Reports (Class C)
export async function getPartnerBriefSummary(): Promise<PartnerBriefSummaryReport> {
  const response = await api.get<PartnerBriefSummaryReport>(
    "/api/v1/partner-portal/reports/brief-summary"
  );
  return response.data;
}

export async function getPartnerDeliverableFeedback(
  assignmentId?: string
): Promise<PartnerDeliverableFeedbackReport> {
  const params = assignmentId ? { assignment_id: assignmentId } : undefined;
  const response = await api.get<PartnerDeliverableFeedbackReport>(
    "/api/v1/partner-portal/reports/deliverable-feedback",
    { params }
  );
  return response.data;
}

export async function getPartnerEngagementHistory(): Promise<PartnerEngagementHistoryReport> {
  const response = await api.get<PartnerEngagementHistoryReport>(
    "/api/v1/partner-portal/reports/engagement-history"
  );
  return response.data;
}

// Performance Notices
export type NoticeType = "sla_breach" | "quality_issue";
export type NoticeSeverity = "warning" | "formal_notice" | "final_notice";
export type NoticeStatus = "open" | "acknowledged";

export interface PerformanceNotice {
  id: string;
  partner_id: string;
  program_id: string | null;
  issued_by: string;
  notice_type: NoticeType;
  severity: NoticeSeverity;
  title: string;
  description: string;
  required_action: string | null;
  status: NoticeStatus;
  acknowledged_at: string | null;
  program_title: string | null;
  issuer_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface PerformanceNoticeListResponse {
  notices: PerformanceNotice[];
  total: number;
  unacknowledged_count: number;
}

export async function getMyPerformanceNotices(): Promise<PerformanceNoticeListResponse> {
  const response = await api.get<PerformanceNoticeListResponse>(
    "/api/v1/performance-notices/my"
  );
  return response.data;
}

export async function acknowledgePerformanceNotice(
  noticeId: string
): Promise<PerformanceNotice> {
  const response = await api.post<PerformanceNotice>(
    `/api/v1/performance-notices/my/${noticeId}/acknowledge`
  );
  return response.data;
}

// Bulk Deliverable Submit

export interface BulkSubmitItemMeta {
  assignment_id: string;
  title?: string;
  notes?: string;
}

export interface BulkSubmitFileResult {
  filename: string;
  success: boolean;
  deliverable_id: string | null;
  error: string | null;
}

export interface BulkSubmitResponse {
  results: BulkSubmitFileResult[];
  total: number;
  succeeded: number;
  failed: number;
}

export async function bulkSubmitDeliverables(
  files: File[],
  items: BulkSubmitItemMeta[]
): Promise<BulkSubmitResponse> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  formData.append("metadata", JSON.stringify(items));
  const response = await api.post<BulkSubmitResponse>(
    "/api/v1/partner-portal/deliverables/bulk-submit",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return response.data;
}

// Capability Refresh
export async function getCapabilityRefreshStatus(): Promise<CapabilityRefreshStatus> {
  const response = await api.get<CapabilityRefreshStatus>(
    "/api/v1/partner-portal/capability-refresh/status"
  );
  return response.data;
}

export async function submitCapabilityRefresh(
  data: CapabilityRefreshRequest
): Promise<PartnerProfile> {
  const response = await api.post<PartnerProfile>(
    "/api/v1/partner-portal/capability-refresh",
    data
  );
  return response.data;
}

// ── Partner Scorecard ─────────────────────────────────────────────────────────

export type ScorecardPeriod = "30d" | "90d" | "ytd";

export interface ScorecardMetrics {
  composite_score: number | null;
  sla_compliance_pct: number | null;
  avg_response_time_hours: number | null;
  quality_score: number | null;
  on_time_delivery_rate: number | null;
  client_satisfaction: number | null;
}

export interface ScorecardRatingBreakdown {
  avg_quality: number | null;
  avg_timeliness: number | null;
  avg_communication: number | null;
  avg_overall: number | null;
}

export interface ScorecardTotals {
  total_assignments: number;
  completed_assignments: number;
  total_sla_checked: number;
  total_sla_breached: number;
  total_ratings: number;
}

export interface ScorecardAverages {
  composite_score: number | null;
  sla_compliance_pct: number | null;
  quality_score: number | null;
  client_satisfaction: number | null;
}

export interface ScorecardDataPoint {
  week_start: string;
  sla_compliance_pct: number | null;
  avg_quality: number | null;
  avg_overall: number | null;
  assignments_completed: number;
}

export interface PartnerScorecard {
  partner_id: string;
  firm_name: string;
  period: string;
  metrics: ScorecardMetrics;
  rating_breakdown: ScorecardRatingBreakdown;
  totals: ScorecardTotals;
  averages: ScorecardAverages;
  data_points: ScorecardDataPoint[];
}

export async function getMyScorecard(period: ScorecardPeriod = "90d"): Promise<PartnerScorecard> {
  const response = await api.get<PartnerScorecard>("/api/v1/partner-portal/scorecard", {
    params: { period },
  });
  return response.data;
}

// ─── Calendar ────────────────────────────────────────────────────────────────

export type CalendarEventType = "assignment" | "deliverable";

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  due_date: string; // YYYY-MM-DD
  status: string;
  program_title: string | null;
  program_id: string | null;
  assignment_id: string;
  assignment_title: string | null; // null for assignment-type events
  deliverable_type: string | null;
}

export interface CalendarParams {
  include_completed?: boolean;
  program_id?: string;
}

export async function getMyCalendarEvents(
  params?: CalendarParams
): Promise<CalendarEvent[]> {
  const response = await api.get<CalendarEvent[]>(
    "/api/v1/partner-portal/calendar",
    { params }
  );
  return response.data;
}

// Performance status vs thresholds

export interface PerformanceMetricAlert {
  metric: string;
  label: string;
  current_value: number | null;
  threshold: number;
  status: "good" | "warning" | "critical";
  trend: "improving" | "declining" | "stable" | "insufficient_data";
  suggestion: string;
}

export interface PerformanceStatusResponse {
  partner_id: string;
  firm_name: string;
  overall_status: "good" | "warning" | "critical";
  metrics: Record<string, number | null>;
  thresholds: Record<string, number>;
  alerts: PerformanceMetricAlert[];
}

export async function getMyPerformanceStatus(): Promise<PerformanceStatusResponse> {
  const response = await api.get<PerformanceStatusResponse>(
    "/api/v1/partner-portal/performance-status"
  );
  return response.data;
}

// ─── Partner Payments ─────────────────────────────────────────────────────────

export interface PartnerPayment {
  id: string;
  partner_id: string;
  assignment_id: string | null;
  amount: string; // Decimal serialised as string
  currency: string;
  payment_method: string;
  reference: string | null;
  payment_date: string; // YYYY-MM-DD
  notes: string | null;
  recorded_by: string;
  assignment_title: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentListResponse {
  payments: PartnerPayment[];
  total: number;
}

export interface PaymentSummary {
  total_all_time: string;
  total_ytd: string;
  payment_count: number;
  payment_count_ytd: number;
  average_amount: string | null;
}

export interface PaymentListParams {
  skip?: number;
  limit?: number;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  payment_method?: string;
}

export async function getMyPayments(
  params?: PaymentListParams
): Promise<PaymentListResponse> {
  const response = await api.get<PaymentListResponse>(
    "/api/v1/partner-portal/payments",
    { params }
  );
  return response.data;
}

export async function getMyPaymentSummary(): Promise<PaymentSummary> {
  const response = await api.get<PaymentSummary>(
    "/api/v1/partner-portal/payments/summary"
  );
  return response.data;
}

export function buildPaymentExportUrl(params?: {
  date_from?: string;
  date_to?: string;
  payment_method?: string;
}): string {
  const base = "/api/v1/partner-portal/payments/export/csv";
  if (!params) return base;
  const qs = new URLSearchParams();
  if (params.date_from) qs.set("date_from", params.date_from);
  if (params.date_to) qs.set("date_to", params.date_to);
  if (params.payment_method) qs.set("payment_method", params.payment_method);
  const str = qs.toString();
  return str ? `${base}?${str}` : base;
}
