/**
 * Partner types — re-exported from generated OpenAPI types where possible.
 *
 * API types are sourced from generated.ts (auto-generated from FastAPI OpenAPI schema).
 * Frontend-only types (UI state, constants, query params) remain manual.
 *
 * To refresh: npm run generate:types (requires backend at localhost:8000)
 *
 * @see backend/app/schemas/partner.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type PartnerProfile = components["schemas"]["PartnerProfileResponse"];
export type PartnerListResponse = components["schemas"]["PartnerProfileListResponse"];
export type PartnerCreateData = components["schemas"]["PartnerProfileCreate"];
export type PartnerUpdateData = components["schemas"]["PartnerProfileUpdate"];
export type PartnerProvisionData = components["schemas"]["PartnerProvisionRequest"];
export type PartnerCapacityHeatmap = components["schemas"]["PartnerCapacityHeatmapResponse"];
export type PartnerCapacitySummaryEntry = components["schemas"]["PartnerCapacitySummaryEntry"];
export type AllPartnersCapacitySummary = components["schemas"]["AllPartnersCapacitySummaryResponse"];
export type BlockedDate = components["schemas"]["BlockedDateResponse"];
export type BlockedDateCreate = components["schemas"]["BlockedDateCreate"];
export type PartnerComparisonItem = components["schemas"]["PartnerComparisonItem"];
export type PartnerComparisonResponse = components["schemas"]["PartnerComparisonResponse"];
export type PartnerDuplicateCheckRequest = components["schemas"]["PartnerDuplicateCheckRequest"];
export type PartnerDuplicateMatch = components["schemas"]["PartnerDuplicateMatchResponse"];
export type RefreshDuePartner = components["schemas"]["RefreshDuePartnerResponse"];
export type RefreshDuePartnerListResponse = components["schemas"]["RefreshDuePartnerListResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, query params, display helpers
// ---------------------------------------------------------------------------

export type CapacityStatus = "available" | "partial" | "full" | "blocked";

export interface CapacityDayEntry {
  active_assignments: number;
  max_concurrent: number;
  is_blocked: boolean;
  block_reason: string | null;
  utilisation: number;
  status: CapacityStatus;
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

export interface PartnerListParams {
  skip?: number;
  limit?: number;
  capability?: string;
  geography?: string;
  availability?: string;
  status?: string;
  search?: string;
}

// Performance Trends (frontend display types)

export interface TrendDataPoint {
  week_start: string;
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
  date: string;
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
