/** Types for the meeting scheduler. */

export type MeetingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export interface MeetingType {
  id: string;
  slug: "quick_checkin" | "standard" | "extended";
  label: string;
  duration_minutes: number;
  description: string | null;
  is_active: boolean;
  display_order: number;
}

export interface RMAvailability {
  id: string;
  rm_id: string;
  day_of_week: number; // 0 = Monday … 6 = Sunday
  start_time: string; // "HH:MM:SS"
  end_time: string;
  buffer_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RMAvailabilityCreate {
  day_of_week: number;
  start_time: string;
  end_time: string;
  buffer_minutes?: number;
}

export interface RMBlackout {
  id: string;
  rm_id: string;
  blackout_date: string; // "YYYY-MM-DD"
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RMBlackoutCreate {
  blackout_date: string;
  reason?: string;
}

export interface AvailableSlot {
  start_time: string; // ISO datetime
  end_time: string;
  date: string; // "YYYY-MM-DD"
  rm_id: string;
}

export interface AvailableSlotsResponse {
  slots: AvailableSlot[];
  rm_id: string;
  from_date: string;
  to_date: string;
}

export interface MeetingBook {
  meeting_type_id: string;
  start_time: string; // ISO datetime
  timezone?: string;
  agenda?: string;
}

export interface MeetingCancelRequest {
  reason?: string;
}

export interface MeetingRescheduleRequest {
  new_start_time: string;
  timezone?: string;
  reason?: string;
}

export interface MeetingTypeNested {
  id: string;
  slug: string;
  label: string;
  duration_minutes: number;
}

export interface Meeting {
  id: string;
  meeting_type_id: string;
  meeting_type: MeetingTypeNested | null;
  rm_id: string;
  client_id: string;
  booked_by_user_id: string;
  start_time: string;
  end_time: string;
  timezone: string;
  status: MeetingStatus;
  agenda: string | null;
  notes: string | null;
  virtual_link: string | null;
  cancelled_by_id: string | null;
  cancellation_reason: string | null;
  reschedule_of_id: string | null;
  scheduled_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingListResponse {
  meetings: Meeting[];
  total: number;
}
