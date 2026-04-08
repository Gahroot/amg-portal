/**
 * Client types — re-exported from generated OpenAPI types where possible.
 *
 * API types are sourced from generated.ts (auto-generated from FastAPI OpenAPI schema).
 * Frontend-only types (UI state, constants, query params) remain manual.
 *
 * To refresh: npm run generate:types (requires backend at localhost:8000)
 *
 * @see backend/app/schemas/client.py
 * @see backend/app/schemas/client_profile.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type ClientProfile = components["schemas"]["ClientProfileResponse"];
export type ClientProfileListResponse = components["schemas"]["ClientProfileListResponse"];
export type ClientProfileCreateData = components["schemas"]["ClientProfileCreate"];
export type ClientProfileUpdateData = components["schemas"]["ClientProfileUpdate"];
export type ClientPortalProfile = components["schemas"]["ClientPortalProfileResponse"];
export type ClientProvisionData = components["schemas"]["ClientProvisionRequest"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, structured sub-types, query params
// ---------------------------------------------------------------------------

export type ComplianceStatus = "pending_review" | "under_review" | "cleared" | "flagged" | "rejected";
export type ApprovalStatus = "draft" | "pending_compliance" | "compliance_cleared" | "pending_md_approval" | "approved" | "rejected";
export type SecurityProfileLevel = "standard" | "elevated" | "executive";

// Intelligence File structured types (frontend display helpers)

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
  occurs_on: string;
  years_since: number | null;
}

export interface ClientProfileDatesUpdateData {
  birth_date?: string | null;
  important_dates?: ImportantDate[] | null;
  birthday_reminders_enabled?: boolean;
}

export interface ComplianceReviewData {
  status: "cleared" | "flagged" | "rejected";
  notes: string;
}

export interface MDApprovalData {
  approved: boolean;
  notes?: string;
  assigned_rm_id?: string;
}

export interface ComplianceCertificate {
  profile_id: string;
  legal_name: string;
  compliance_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  certificate_date: string;
}

export interface ClientListParams {
  compliance_status?: string;
  approval_status?: string;
  assigned_rm_id?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

// Security & Intelligence Feed types

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

// Duplicate detection types

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
