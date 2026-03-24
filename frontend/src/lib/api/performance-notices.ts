import api from "@/lib/api";

export type NoticeType = "sla_breach" | "quality_issue" | "general_performance";
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

export interface PerformanceNoticeCreateData {
  partner_id: string;
  program_id?: string | null;
  notice_type: NoticeType;
  severity: NoticeSeverity;
  title: string;
  description: string;
  required_action?: string | null;
}

export async function createPerformanceNotice(
  data: PerformanceNoticeCreateData,
): Promise<PerformanceNotice> {
  const response = await api.post<PerformanceNotice>(
    "/api/v1/performance-notices/",
    data,
  );
  return response.data;
}

export async function listPartnerNotices(
  partnerId: string,
): Promise<PerformanceNoticeListResponse> {
  const response = await api.get<PerformanceNoticeListResponse>(
    `/api/v1/performance-notices/partner/${partnerId}`,
  );
  return response.data;
}
