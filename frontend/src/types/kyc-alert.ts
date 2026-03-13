export type KYCAlertSeverity = "low" | "medium" | "high" | "critical";

export type KYCAlertStatus = "new" | "read" | "resolved";

export type KYCAlertType =
  | "document_expired"
  | "document_expiring"
  | "verification_failed"
  | "compliance_flag"
  | "sanctions_match"
  | "pep_match"
  | "adverse_media"
  | "risk_level_change";

export interface KYCAlert {
  id: string;
  client_id: string;
  client_name: string;
  alert_type: KYCAlertType;
  severity: KYCAlertSeverity;
  status: KYCAlertStatus;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
}

export interface KYCAlertListResponse {
  alerts: KYCAlert[];
  total: number;
}

export interface KYCAlertListParams {
  status?: KYCAlertStatus;
  severity?: KYCAlertSeverity;
  alert_type?: KYCAlertType;
  client_id?: string;
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
}

export interface KYCAlertResolveRequest {
  resolution_notes?: string;
}
