/**
 * Calendar feed types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/calendar_feed.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type CalendarFeedToken = components["schemas"]["CalendarFeedTokenResponse"];
export type CalendarFeedTokenCreated = components["schemas"]["CalendarFeedTokenCreatedResponse"];
export type CalendarFeedStatus = components["schemas"]["CalendarFeedStatusResponse"];
export type CalendarFeedTokenCreateRequest = components["schemas"]["CalendarFeedTokenCreate"];

// ---------------------------------------------------------------------------
// Frontend-only types — filter options
// ---------------------------------------------------------------------------

export interface CalendarFeedFilterOptions {
  include_milestones?: boolean;
  include_deadlines?: boolean;
  include_meetings?: boolean;
  days_ahead?: number | null;
}
