/**
 * Calendar integration types
 */

export type CalendarProvider = "google" | "outlook";

export type CalendarEventStatus = "confirmed" | "cancelled";

export type TimeSlot = "free" | "busy" | "tentative" | "unknown";

export interface CalendarConnection {
  id: string;
  provider: CalendarProvider;
  provider_email: string | null;
  calendar_id: string | null;
  calendar_name: string | null;
  is_primary: boolean;
  is_active: boolean;
  sync_milestones: boolean;
  sync_tasks: boolean;
  reminder_minutes: number | null;
  last_sync_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarConnectionCreateData {
  provider: CalendarProvider;
  access_token: string;
  refresh_token?: string;
  token_expires_at?: string;
  calendar_id?: string;
  calendar_name?: string;
  is_primary?: boolean;
  sync_milestones?: boolean;
  sync_tasks?: boolean;
  reminder_minutes?: number;
}

export interface CalendarConnectionUpdateData {
  calendar_id?: string;
  calendar_name?: string;
  is_primary?: boolean;
  is_active?: boolean;
  sync_milestones?: boolean;
  sync_tasks?: boolean;
  reminder_minutes?: number;
}

export interface CalendarConnectionListResponse {
  connections: CalendarConnection[];
  total: number;
}

export interface CalendarListResponse {
  calendars: Array<Record<string, string | boolean>>;
}

export interface CalendarEvent {
  id: string;
  connection_id: string;
  milestone_id: string;
  external_event_id: string;
  event_url: string | null;
  status: CalendarEventStatus;
  last_synced_at: string;
  created_at: string;
}

export interface CalendarReminder {
  id: string;
  milestone_id: string;
  user_id: string;
  reminder_minutes: number;
  notification_sent: boolean;
  notification_sent_at: string | null;
  created_at: string;
}

export interface CalendarReminderCreateData {
  reminder_minutes: number;
}

export interface OAuthAuthorizeRequest {
  provider: CalendarProvider;
  redirect_uri: string;
}

export interface OAuthAuthorizeResponse {
  authorization_url: string;
  state: string;
}

export interface OAuthCallbackRequest {
  provider: CalendarProvider;
  code: string;
  state: string;
  redirect_uri: string;
}

export interface SyncMilestoneRequest {
  connection_id: string;
  event_title?: string;
  event_description?: string;
  reminder_minutes?: number;
}

export interface SyncMilestoneResponse {
  calendar_event_id: string;
  external_event_id: string;
  event_url: string | null;
  status: string;
}

export interface SyncStatusResponse {
  milestone_id: string;
  is_synced: boolean;
  calendar_events: CalendarEvent[];
  reminders: CalendarReminder[];
}

export interface BatchSyncRequest {
  milestone_ids: string[];
  connection_id: string;
}

export interface BatchSyncResponse {
  synced: string[];
  failed: Array<Record<string, string>>;
}

export interface AvailabilityRequest {
  user_ids: string[];
  start_time: string;
  end_time: string;
}

export interface AvailabilitySlot {
  start_time: string;
  end_time: string;
  status: TimeSlot;
}

export interface UserAvailabilityResponse {
  user_id: string;
  user_name: string | null;
  slots: AvailabilitySlot[];
  has_calendar: boolean;
}

export interface AvailabilityResponse {
  start_time: string;
  end_time: string;
  users: UserAvailabilityResponse[];
}
