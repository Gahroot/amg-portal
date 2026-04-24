/**
 * Client timeline types — re-exported from generated OpenAPI types where possible.
 *
 * API types are sourced from generated.ts (auto-generated from FastAPI OpenAPI schema).
 * Frontend-only types (query params) remain manual.
 *
 * To refresh: npm run generate:types (requires backend at localhost:8000)
 *
 * @see backend/app/schemas/client_timeline.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type TimelineEventType = components["schemas"]["TimelineEventType"];
export type TimelineEvent = components["schemas"]["TimelineEventResponse"];
export type TimelineListResponse = components["schemas"]["TimelineListResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — query params
// ---------------------------------------------------------------------------

export interface TimelineFilters {
  event_types?: TimelineEventType[];
  date_from?: string;
  date_to?: string;
}
