import api from "@/lib/api";

// ============================================================================
// Types
// ============================================================================

export interface KPIMetric {
  label: string;
  value: number | null;
  target: number;
  unit: "score" | "percent" | "hours" | "count" | "rate";
  status: "green" | "yellow" | "red";
}

export interface ClientExperienceKPIs {
  nps_score: KPIMetric;
  report_on_time_rate: KPIMetric;
  decision_response_time_hours: KPIMetric;
}

export interface OperationalPerformanceKPIs {
  milestone_on_time_rate: KPIMetric;
  escalation_resolution_hours: KPIMetric;
  deliverable_first_pass_rate: KPIMetric;
  closure_completeness_rate: KPIMetric;
}

export interface PartnerNetworkKPIs {
  avg_partner_score: KPIMetric;
  sla_breach_rate: KPIMetric;
  task_completion_rate: KPIMetric;
  brief_to_acceptance_hours: KPIMetric;
}

export interface ComplianceKPIs {
  kyc_currency_rate: KPIMetric;
  unauthorized_access_incidents: KPIMetric;
  audit_log_completeness: KPIMetric;
  access_review_completion_rate: KPIMetric;
}

export interface AllKPIsResponse {
  client_experience: ClientExperienceKPIs;
  operations: OperationalPerformanceKPIs;
  partner_network: PartnerNetworkKPIs;
  compliance: ComplianceKPIs;
}

// ============================================================================
// API Functions
// ============================================================================

export async function getAllKPIs(): Promise<AllKPIsResponse> {
  const response = await api.get<AllKPIsResponse>("/api/v1/analytics/all");
  return response.data;
}

export async function getClientExperienceKPIs(): Promise<ClientExperienceKPIs> {
  const response = await api.get<ClientExperienceKPIs>(
    "/api/v1/analytics/client-experience",
  );
  return response.data;
}

export async function getOperationsKPIs(): Promise<OperationalPerformanceKPIs> {
  const response = await api.get<OperationalPerformanceKPIs>(
    "/api/v1/analytics/operations",
  );
  return response.data;
}

export async function getPartnerNetworkKPIs(): Promise<PartnerNetworkKPIs> {
  const response = await api.get<PartnerNetworkKPIs>(
    "/api/v1/analytics/partner-network",
  );
  return response.data;
}

export async function getComplianceKPIs(): Promise<ComplianceKPIs> {
  const response = await api.get<ComplianceKPIs>(
    "/api/v1/analytics/compliance",
  );
  return response.data;
}
