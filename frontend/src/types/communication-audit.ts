/**
 * Communication audit types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/communication_audit.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type CommunicationAuditRecord = components["schemas"]["CommunicationAuditResponse"];
export type CommunicationAuditListResponse = components["schemas"]["CommunicationAuditListResponse"];
export type CommunicationPreferences = components["schemas"]["CommunicationPreferencesResponse"];
export type CommunicationPreferencesUpdate = components["schemas"]["CommunicationPreferencesUpdate"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, query params
// ---------------------------------------------------------------------------

export type CommunicationAuditAction =
  | "created"
  | "sent"
  | "viewed"
  | "replied"
  | "forwarded"
  | "archived"
  | "deleted"
  | "status_changed";

export type PreferredChannel = "email" | "phone" | "portal" | "sms";

export interface CommunicationAuditSearchParams {
  action?: CommunicationAuditAction;
  actor_id?: string;
  communication_id?: string;
  conversation_id?: string;
  start_date?: string;
  end_date?: string;
  skip?: number;
  limit?: number;
}

export interface ChannelCheckResponse {
  allowed: boolean;
  reason: string | null;
}
