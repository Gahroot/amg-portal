/**
 * Client types - manually maintained.
 *
 * MIGRATION NOTE:
 *   Types in this file should gradually migrate to src/types/generated.ts
 *   which is auto-generated from the FastAPI OpenAPI schema.
 *
 *   Run `npm run generate:types` to update generated types.
 *   Then re-export from generated.ts:
 *     export type ClientProfile = components["schemas"]["ClientProfile"];
 *
 *   Keep frontend-specific extensions (UI state, computed fields) here.
 */

export type ComplianceStatus = "pending_review" | "under_review" | "cleared" | "flagged" | "rejected";
export type ApprovalStatus = "draft" | "pending_compliance" | "compliance_cleared" | "pending_md_approval" | "approved" | "rejected";
export type SecurityProfileLevel = "standard" | "elevated" | "executive";

// ---------------------------------------------------------------------------
// Intelligence File structured types
// ---------------------------------------------------------------------------

export interface KeyRelationship {
  name: string;
  relationship: string;
  notes: string | null;
}

export interface LifestyleProfile {
  travel_preferences: string | null;
  dietary_restrictions: string | null;
  interests: string[];
  preferred_destinations: string[];
  language_preference: string | null;
}

export interface IntelligenceFile {
  objectives: string[];
  preferences: Record<string, string>;
  sensitivities: string[];
  key_relationships: KeyRelationship[];
  lifestyle_profile: LifestyleProfile;
}

export interface ImportantDate {
  label: string;
  month: number;
  day: number;
  year: number | null;
  recurring: boolean;
}

export interface UpcomingDateItem {
  client_id: string;
  client_name: string;
  rm_id: string;
  date_type: string;
  label: string;
  days_until: number;
  occurs_on: string; // ISO date string
  years_since: number | null;
}

export interface ClientProfile {
  id: string;
  legal_name: string;
  display_name: string | null;
  entity_type: string | null;
  jurisdiction: string | null;
  tax_id: string | null;
  primary_email: string;
  secondary_email: string | null;
  phone: string | null;
  address: string | null;
  communication_preference: string | null;
  sensitivities: string | null;
  special_instructions: string | null;
  compliance_status: ComplianceStatus;
  approval_status: ApprovalStatus;
  compliance_notes: string | null;
  compliance_reviewed_by: string | null;
  compliance_reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  assigned_rm_id: string | null;
  security_profile_level: SecurityProfileLevel;
  intelligence_file: IntelligenceFile | null;
  user_id: string | null;
  welcome_email_sent: boolean;
  portal_access_enabled: boolean;
  birth_date: string | null;
  important_dates: ImportantDate[] | null;
  birthday_reminders_enabled: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface ClientProfileListResponse {
  profiles: ClientProfile[];
  total: number;
}

export interface ClientProfileCreateData {
  legal_name: string;
  display_name?: string;
  entity_type?: string;
  jurisdiction?: string;
  tax_id?: string;
  primary_email: string;
  secondary_email?: string;
  phone?: string;
  address?: string;
  communication_preference?: string;
  sensitivities?: string;
  special_instructions?: string;
}

export interface ClientProfileDatesUpdateData {
  birth_date?: string | null;
  important_dates?: ImportantDate[] | null;
  birthday_reminders_enabled?: boolean;
}

export type ClientProfileUpdateData = Partial<ClientProfileCreateData> & ClientProfileDatesUpdateData;

export interface ComplianceReviewData {
  status: "cleared" | "flagged" | "rejected";
  notes: string;
}

export interface MDApprovalData {
  approved: boolean;
  notes?: string;
  assigned_rm_id?: string;
}

export interface ClientProvisionData {
  send_welcome_email: boolean;
  password?: string;
}

export interface ComplianceCertificate {
  profile_id: string;
  legal_name: string;
  compliance_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  certificate_date: string;
}

export interface ClientPortalProfile {
  id: string;
  legal_name: string;
  display_name: string | null;
  entity_type: string | null;
  jurisdiction: string | null;
  primary_email: string;
  compliance_status: ComplianceStatus;
  approval_status: ApprovalStatus;
  created_at: string;
}

export interface ClientListParams {
  compliance_status?: string;
  approval_status?: string;
  assigned_rm_id?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Security & Intelligence Feed types (Phase 2 — need-to-know only)
// ---------------------------------------------------------------------------

export interface ThreatAlert {
  alert_id: string | null;
  severity: string;
  category: string;
  title: string;
  summary: string;
  source: string | null;
  detected_at: string | null;
}

export interface ThreatSummary {
  client_id: string;
  threat_level: string;
  feed_status: string;
  feed_error: string | null;
  alerts: ThreatAlert[];
  last_updated: string | null;
  note: string | null;
}

export interface TravelAdvisory {
  destination: string;
  risk_level: string;
  feed_status: string;
  feed_error: string | null;
  summary: string;
  key_risks: string[];
  last_updated: string | null;
}

export interface SecurityBrief {
  client_id: string;
  generated_at: string;
  provider: string;
  feed_connected: boolean;
  threat_summary: ThreatSummary;
  travel_advisories: TravelAdvisory[];
  access_logged: boolean;
  disclaimer: string;
}

export interface SecurityProfileLevelUpdate {
  security_profile_level: SecurityProfileLevel;
}

// ---------------------------------------------------------------------------
// Duplicate detection types
// ---------------------------------------------------------------------------

export interface DuplicateCheckRequest {
  legal_name?: string | null;
  primary_email?: string | null;
  phone?: string | null;
  exclude_id?: string | null;
}

export interface DuplicateMatch {
  client_id: string;
  legal_name: string;
  display_name: string | null;
  primary_email: string;
  phone: string | null;
  similarity_score: number;
  match_reasons: string[];
}
