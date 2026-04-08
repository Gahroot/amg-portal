/**
 * SLA tracker types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/sla_tracker.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type SLATracker = components["schemas"]["SLATrackerResponse"];
export type SLATrackerListResponse = components["schemas"]["SLATrackerListResponse"];
export type SLACreate = components["schemas"]["SLACreate"];
export type SLABreachAlertResponse = components["schemas"]["SLABreachAlertResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, query params
// ---------------------------------------------------------------------------

export type CommunicationType = "email" | "portal_message" | "phone" | "partner_submission" | "client_inquiry";
export type SLABreachStatus = "within_sla" | "approaching_breach" | "breached";

export interface SLAListParams {
  skip?: number;
  limit?: number;
  breach_status?: string;
  entity_type?: string;
}
