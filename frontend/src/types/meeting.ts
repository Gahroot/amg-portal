/**
 * Meeting types — re-exported from generated OpenAPI types where possible.
 *
 * API types are sourced from generated.ts (auto-generated from FastAPI OpenAPI schema).
 * Frontend-only types remain manual.
 *
 * To refresh: npm run generate:types (requires backend at localhost:8000)
 *
 * @see backend/app/schemas/meeting.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type Meeting = components["schemas"]["MeetingResponse"];
export type MeetingListResponse = components["schemas"]["MeetingListResponse"];
export type AvailableSlot = components["schemas"]["AvailableSlot"];
export type AvailableSlotsResponse = components["schemas"]["AvailableSlotsResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types
// ---------------------------------------------------------------------------

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
  day_of_week: number;
  start_time: string;
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
  blackout_date: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RMBlackoutCreate {
  blackout_date: string;
  reason?: string;
}

export interface MeetingBook {
  meeting_type_id: string;
  start_time: string;
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
