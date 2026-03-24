/** Types for scheduling and coordination. */

export type EventType = "meeting" | "call" | "site_visit" | "review" | "deadline";
export type EventStatus = "scheduled" | "confirmed" | "cancelled" | "completed";

export interface ScheduledEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  start_time: string;
  end_time: string;
  timezone: string;
  location: string | null;
  virtual_link: string | null;
  organizer_id: string;
  program_id: string | null;
  client_id: string | null;
  attendee_ids: string[] | null;
  status: EventStatus;
  recurrence_rule: string | null;
  reminder_minutes: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

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

export interface ScheduledEventListResponse {
  events: ScheduledEvent[];
  total: number;
}

export interface ConflictCheckResponse {
  has_conflicts: boolean;
  conflicts: ScheduledEvent[];
}
