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
export type MeetingBook = components["schemas"]["MeetingBook"];
export type MeetingCancelRequest = components["schemas"]["MeetingCancelRequest"];
export type MeetingRescheduleRequest = components["schemas"]["MeetingRescheduleRequest"];
export type MeetingType = components["schemas"]["MeetingTypeResponse"];
export type MeetingTypeNested = components["schemas"]["MeetingTypeNestedResponse"];
export type RMAvailability = components["schemas"]["RMAvailabilityResponse"];
export type RMAvailabilityCreate = components["schemas"]["RMAvailabilityCreate"];
export type RMBlackout = components["schemas"]["RMBlackoutResponse"];
export type RMBlackoutCreate = components["schemas"]["RMBlackoutCreate"];

// ---------------------------------------------------------------------------
// Frontend-only types — display enums
// ---------------------------------------------------------------------------

export type MeetingStatus = "pending" | "confirmed" | "cancelled" | "completed";
