/**
 * Scheduling types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/scheduled_event.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type ScheduledEvent = components["schemas"]["ScheduledEventResponse"];
export type ScheduledEventListResponse = components["schemas"]["ScheduledEventListResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, request shapes
// ---------------------------------------------------------------------------

export type EventType = "meeting" | "call" | "site_visit" | "review" | "deadline";
export type EventStatus = "scheduled" | "confirmed" | "cancelled" | "completed";

export interface ScheduledEventCreate {
  title: string;
  description?: string;
  event_type: EventType;
  start_time: string;
  end_time: string;
  timezone?: string;
  location?: string;
  virtual_link?: string;
  program_id?: string;
  client_id?: string;
  attendee_ids?: string[];
  recurrence_rule?: string;
  reminder_minutes?: number;
  notes?: string;
}

export interface ScheduledEventUpdate {
  title?: string;
  description?: string;
  event_type?: EventType;
  start_time?: string;
  end_time?: string;
  timezone?: string;
  location?: string;
  virtual_link?: string;
  program_id?: string;
  client_id?: string;
  attendee_ids?: string[];
  status?: EventStatus;
  recurrence_rule?: string;
  reminder_minutes?: number;
  notes?: string;
}

export interface ConflictCheckResponse {
  has_conflicts: boolean;
  conflicts: ScheduledEvent[];
}
