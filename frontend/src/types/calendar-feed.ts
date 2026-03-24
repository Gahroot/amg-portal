/**
 * Types for calendar feed token management.
 */

/**
 * Calendar feed token (without the actual token value)
 */
export interface CalendarFeedToken {
  id: string;
  name: string;
  is_active: boolean;
  last_accessed_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

/**
 * Calendar feed token with full URL (returned only on create/regenerate)
 */
export interface CalendarFeedTokenCreated extends CalendarFeedToken {
  feed_url: string;
  token: string;
  warning: string;
}

/**
 * Calendar feed status response
 */
export interface CalendarFeedStatus {
  has_active_token: boolean;
  active_token: CalendarFeedToken | null;
  feed_url: string | null;
}

/**
 * Request to create a calendar feed token
 */
export interface CalendarFeedTokenCreateRequest {
  name?: string;
}

/**
 * Calendar feed filter options (for future use)
 */
export interface CalendarFeedFilterOptions {
  include_milestones?: boolean;
  include_deadlines?: boolean;
  include_meetings?: boolean;
  days_ahead?: number | null;
}
