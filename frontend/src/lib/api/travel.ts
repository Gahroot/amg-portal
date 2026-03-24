/** API client for travel booking endpoints. */

import api from "@/lib/api";
import type {
  TravelBooking,
  TravelBookingCreate,
  TravelBookingUpdate,
  TravelBookingListResponse,
} from "@/types/travel-booking";

export type {
  TravelBooking,
  TravelBookingCreate,
  TravelBookingUpdate,
  TravelBookingListResponse,
};

/**
 * Get all travel bookings for a program (itinerary).
 */
export async function getProgramTravel(
  programId: string
): Promise<TravelBookingListResponse> {
  const response = await api.get<TravelBookingListResponse>(
    `/api/v1/programs/${programId}/travel`
  );
  return response.data;
}

/**
 * Create a new travel booking for a program.
 */
export async function createTravelBooking(
  programId: string,
  data: TravelBookingCreate
): Promise<TravelBooking> {
  const response = await api.post<TravelBooking>(
    `/api/v1/programs/${programId}/travel`,
    data
  );
  return response.data;
}

/**
 * Update an existing travel booking.
 */
export async function updateTravelBooking(
  programId: string,
  bookingId: string,
  data: TravelBookingUpdate
): Promise<TravelBooking> {
  const response = await api.patch<TravelBooking>(
    `/api/v1/programs/${programId}/travel/${bookingId}`,
    data
  );
  return response.data;
}

/**
 * Delete a travel booking.
 */
export async function deleteTravelBooking(
  programId: string,
  bookingId: string
): Promise<void> {
  await api.delete(`/api/v1/programs/${programId}/travel/${bookingId}`);
}
