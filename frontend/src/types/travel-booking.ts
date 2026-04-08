/**
 * Travel booking types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/travel_booking.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type TravelBooking = components["schemas"]["TravelBookingResponse"];
export type TravelBookingCreate = components["schemas"]["TravelBookingCreate"];
export type TravelBookingUpdate = components["schemas"]["TravelBookingUpdate"];
export type TravelBookingListResponse = components["schemas"]["TravelBookingListResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums
// ---------------------------------------------------------------------------

export type TravelBookingType = "flight" | "hotel" | "transfer" | "venue";
export type TravelBookingStatus = "confirmed" | "pending" | "cancelled" | "completed";
export type TravelBookingSource = "manual" | "api" | "webhook";
