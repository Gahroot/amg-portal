export interface PartnerProfile {
  id: string;
  user_id: string | null;
  firm_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  capabilities: string[];
  geographies: string[];
  availability_status: string;
  performance_rating: number | null;
  total_assignments: number;
  completed_assignments: number;
  max_concurrent_assignments: number;
  /** True while completed_assignments < 3 — probationary period per design spec. */
  is_on_probation: boolean;
  compliance_doc_url: string | null;
  compliance_verified: boolean;
  notes: string | null;
  status: string;
  last_refreshed_at: string | null;
  refresh_due_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Duplicate detection types
// ---------------------------------------------------------------------------

export interface PartnerDuplicateCheckRequest {
  firm_name?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  exclude_id?: string | null;
}

export interface PartnerDuplicateMatch {
  partner_id: string;
  firm_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  similarity_score: number;
  match_reasons: string[];
}

// ── Capacity / Heatmap types ─────────────────────────────────────────────────

export type CapacityStatus = "available" | "partial" | "full" | "blocked";

export interface CapacityDayEntry {
  active_assignments: number;
  max_concurrent: number;
  is_blocked: boolean;
  block_reason: string | null;
  utilisation: number;
  status: CapacityStatus;
}

export interface PartnerCapacityHeatmap {
  partner_id: string;
  start_date: string;
  end_date: string;
  days: Record<string, CapacityDayEntry>;
}

export interface BlockedDate {
  id: string;
  partner_id: string;
  blocked_date: string;
  reason: string | null;
  created_by: string;
  created_at: string;
}

export interface BlockedDateCreate {
  blocked_date: string;
  reason?: string;
}

export interface PartnerCapacitySummaryEntry {
  partner_id: string;
  firm_name: string;
  contact_name: string;
  availability_status: string;
  active_assignments: number;
  max_concurrent: number;
  is_blocked: boolean;
  utilisation: number;
  status: CapacityStatus;
}

export interface AllPartnersCapacitySummary {
  target_date: string;
  partners: PartnerCapacitySummaryEntry[];
}

export interface CapabilityRefreshStatus {
  last_refreshed_at: string | null;
  refresh_due_at: string | null;
  is_overdue: boolean;
  is_due_soon: boolean;
  days_until_due: number | null;
}

export interface CapabilityRefreshRequest {
  accreditations_confirmed: boolean;
  insurance_confirmed: boolean;
  capacity_confirmed: boolean;
  notes?: string;
}

export interface RefreshDuePartner {
  id: string;
  firm_name: string;
  contact_name: string;
  contact_email: string;
  status: string;
  last_refreshed_at: string | null;
  refresh_due_at: string | null;
  is_overdue: boolean;
  days_until_due: number | null;
}

export interface RefreshDuePartnerListResponse {
  partners: RefreshDuePartner[];
  total: number;
}

export interface PartnerListResponse {
  profiles: PartnerProfile[];
  total: number;
}

export interface PartnerListParams {
  skip?: number;
  limit?: number;
  capability?: string;
  geography?: string;
  availability?: string;
  status?: string;
  search?: string;
}

export interface PartnerCreateData {
  firm_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  capabilities: string[];
  geographies: string[];
  notes?: string;
}

export interface PartnerUpdateData {
  firm_name?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  capabilities?: string[];
  geographies?: string[];
  availability_status?: string;
  compliance_verified?: boolean;
  notes?: string;
  status?: string;
}

export interface PartnerProvisionData {
  password?: string;
  send_welcome_email?: boolean;
}

// ── Partner Comparison types ──────────────────────────────────────────────────

export interface PartnerComparisonItem {
  partner_id: string;
  firm_name: string;
  contact_name: string;
  availability_status: string;
  status: string;
  capabilities: string[];
  geographies: string[];
  compliance_verified: boolean;

  // Rating dimensions (1–5 scale)
  avg_quality: number | null;
  avg_timeliness: number | null;
  avg_communication: number | null;
  avg_overall: number | null;
  total_ratings: number;

  // SLA
  sla_compliance_rate: number | null; // 0–100 %
  total_sla_tracked: number;
  total_sla_breached: number;

  // Assignment history
  total_assignments: number;
  completed_assignments: number;
  active_assignments: number;

  // Capacity
  max_concurrent_assignments: number;
  capacity_utilisation: number; // 0–100 %
  remaining_capacity: number;

  // Composite score & trend
  composite_score: number | null; // 0–100
  avg_recent_overall: number | null;
  trend_direction: "up" | "down" | "neutral";
}

export interface PartnerComparisonResponse {
  partners: PartnerComparisonItem[];
}

// ─── Performance Trends ───────────────────────────────────────────────────────

export interface TrendDataPoint {
  week_start: string; // ISO date (Monday of week)
  sla_compliance_pct: number | null;
  avg_quality: number | null;
  avg_timeliness: number | null;
  avg_communication: number | null;
  avg_overall: number | null;
  completion_rate: number | null;
  sla_total: number;
  sla_breached: number;
  ratings_count: number;
  assignments_completed: number;
}

export interface TrendAnnotation {
  date: string; // ISO date
  event_type: "governance" | "notice" | "rating";
  label: string;
  severity: string | null;
}

export interface PartnerTrendsSummary {
  overall_sla_compliance_pct: number | null;
  overall_avg_quality: number | null;
  total_completed_assignments: number;
  total_assigned: number;
  completion_rate_pct: number | null;
  total_sla_checked: number;
  total_sla_breached: number;
}

export interface PartnerTrends {
  partner_id: string;
  firm_name: string;
  days: number;
  summary: PartnerTrendsSummary;
  data_points: TrendDataPoint[];
  annotations: TrendAnnotation[];
}
