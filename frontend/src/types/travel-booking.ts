/** Types for travel booking / itinerary management. */

export type TravelBookingType = "flight" | "hotel" | "transfer" | "venue";
export type TravelBookingStatus = "confirmed" | "pending" | "cancelled" | "completed";
export type TravelBookingSource = "manual" | "api" | "webhook";

export interface TravelBooking {
  id: string;
  program_id: string;
  booking_ref: string;
  vendor: string;
  type: TravelBookingType;
  departure_at: string | null;
  arrival_at: string | null;
  passengers: string[] | null;
  details: Record<string, unknown> | null;
  status: TravelBookingStatus;
  source: TravelBookingSource;
  raw_data: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TravelBookingCreate {
  booking_ref: string;
  vendor: string;
  type: TravelBookingType;
  departure_at?: string;
  arrival_at?: string;
  passengers?: string[];
  details?: Record<string, unknown>;
  status?: TravelBookingStatus;
}

export interface TravelBookingUpdate {
  booking_ref?: string;
  vendor?: string;
  type?: TravelBookingType;
  departure_at?: string;
  arrival_at?: string;
  passengers?: string[];
  details?: Record<string, unknown>;
  status?: TravelBookingStatus;
}

export interface TravelBookingListResponse {
  bookings: TravelBooking[];
  total: number;
}
