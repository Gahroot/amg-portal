/**
 * API client for calendar feed token management.
 */

import api from "@/lib/api";
import type {
  CalendarFeedStatus,
  CalendarFeedTokenCreated,
  CalendarFeedTokenCreateRequest,
} from "@/types/calendar-feed";

/**
 * Get calendar feed status for the current user
 */
export async function getCalendarFeedStatus(): Promise<CalendarFeedStatus> {
  const response = await api.get<CalendarFeedStatus>("/api/v1/calendar/feed/status");
  return response.data;
}

/**
 * Create a new calendar feed token
 * @returns The created token with the full feed URL (shown only once!)
 */
export async function createCalendarFeedToken(
  data?: CalendarFeedTokenCreateRequest
): Promise<CalendarFeedTokenCreated> {
  const response = await api.post<CalendarFeedTokenCreated>("/api/v1/calendar/feed/tokens", data || {});
  return response.data;
}

/**
 * Regenerate a calendar feed token (revokes old, creates new)
 * @returns The new token with the full feed URL (shown only once!)
 */
export async function regenerateCalendarFeedToken(tokenId: string): Promise<CalendarFeedTokenCreated> {
  const response = await api.post<CalendarFeedTokenCreated>(
    `/api/v1/calendar/feed/tokens/${tokenId}/regenerate`
  );
  return response.data;
}

/**
 * Revoke a calendar feed token
 */
export async function revokeCalendarFeedToken(tokenId: string): Promise<void> {
  await api.delete(`/api/v1/calendar/feed/tokens/${tokenId}`);
}
