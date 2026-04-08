/**
 * Communication log types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/communication_log.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type CommunicationLogChannel = components["schemas"]["CommunicationLogChannel"];
export type CommunicationLogDirection = components["schemas"]["CommunicationLogDirection"];
export type CommunicationLog = components["schemas"]["CommunicationLogResponse"];
export type CommunicationLogListResponse = components["schemas"]["CommunicationLogListResponse"];
export type CommunicationLogCreateData = components["schemas"]["CommunicationLogCreate"];
export type CommunicationLogUpdateData = components["schemas"]["CommunicationLogUpdate"];

// ---------------------------------------------------------------------------
// Frontend-only types — query params
// ---------------------------------------------------------------------------

export interface CommunicationLogListParams {
  client_id?: string;
  partner_id?: string;
  program_id?: string;
  channel?: string;
  direction?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  skip?: number;
  limit?: number;
}
