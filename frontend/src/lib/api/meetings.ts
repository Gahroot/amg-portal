/** API client for meeting scheduler endpoints. */

import api from "@/lib/api";
import type {
  AvailableSlotsResponse,
  Meeting,
  MeetingBook,
  MeetingCancelRequest,
  MeetingListResponse,
  MeetingRescheduleRequest,
  MeetingType,
  RMAvailability,
  RMAvailabilityCreate,
  RMBlackout,
  RMBlackoutCreate,
} from "@/types/meeting";

// ─── Meeting Types ────────────────────────────────────────────────────────────

export async function listMeetingTypes(): Promise<MeetingType[]> {
  const response = await api.get<MeetingType[]>("/api/v1/meetings/types");
  return response.data;
}

// ─── Available Slots ──────────────────────────────────────────────────────────

export interface GetAvailableSlotsParams {
  meeting_type_id: string;
  rm_id?: string;
  from_date?: string;
  to_date?: string;
}

export async function getAvailableSlots(
  params: GetAvailableSlotsParams
): Promise<AvailableSlotsResponse> {
  const response = await api.get<AvailableSlotsResponse>(
    "/api/v1/meetings/slots",
    { params }
  );
  return response.data;
}

// ─── Booking (client) ─────────────────────────────────────────────────────────

export async function bookMeeting(data: MeetingBook): Promise<Meeting> {
  const response = await api.post<Meeting>("/api/v1/meetings/", data);
  return response.data;
}

export async function listMyMeetings(params?: {
  status?: string;
  skip?: number;
  limit?: number;
}): Promise<MeetingListResponse> {
  const response = await api.get<MeetingListResponse>(
    "/api/v1/meetings/my",
    { params }
  );
  return response.data;
}

// ─── RM Meetings (internal) ───────────────────────────────────────────────────

export async function listRMMeetings(params?: {
  status?: string;
  skip?: number;
  limit?: number;
}): Promise<MeetingListResponse> {
  const response = await api.get<MeetingListResponse>(
    "/api/v1/meetings/rm",
    { params }
  );
  return response.data;
}

// ─── Individual meeting ───────────────────────────────────────────────────────

export async function getMeeting(meetingId: string): Promise<Meeting> {
  const response = await api.get<Meeting>(
    `/api/v1/meetings/${meetingId}`
  );
  return response.data;
}

export async function confirmMeeting(meetingId: string): Promise<Meeting> {
  const response = await api.post<Meeting>(
    `/api/v1/meetings/${meetingId}/confirm`
  );
  return response.data;
}

export async function cancelMeeting(
  meetingId: string,
  data?: MeetingCancelRequest
): Promise<Meeting> {
  const response = await api.post<Meeting>(
    `/api/v1/meetings/${meetingId}/cancel`,
    data ?? {}
  );
  return response.data;
}

export async function rescheduleMeeting(
  meetingId: string,
  data: MeetingRescheduleRequest
): Promise<Meeting> {
  const response = await api.post<Meeting>(
    `/api/v1/meetings/${meetingId}/reschedule`,
    data
  );
  return response.data;
}

// ─── RM Availability Management ───────────────────────────────────────────────

export async function getMyAvailability(): Promise<RMAvailability[]> {
  const response = await api.get<RMAvailability[]>(
    "/api/v1/meetings/availability"
  );
  return response.data;
}

export async function getRMAvailability(
  rmId: string
): Promise<RMAvailability[]> {
  const response = await api.get<RMAvailability[]>(
    `/api/v1/meetings/availability/rm/${rmId}`
  );
  return response.data;
}

export async function createAvailability(
  data: RMAvailabilityCreate
): Promise<RMAvailability> {
  const response = await api.post<RMAvailability>(
    "/api/v1/meetings/availability",
    data
  );
  return response.data;
}

export async function deleteAvailability(slotId: string): Promise<void> {
  await api.delete(`/api/v1/meetings/availability/${slotId}`);
}

// ─── Blackouts ────────────────────────────────────────────────────────────────

export async function listBlackouts(
  fromDate?: string
): Promise<RMBlackout[]> {
  const response = await api.get<RMBlackout[]>("/api/v1/meetings/blackouts", {
    params: fromDate ? { from_date: fromDate } : undefined,
  });
  return response.data;
}

export async function createBlackout(
  data: RMBlackoutCreate
): Promise<RMBlackout> {
  const response = await api.post<RMBlackout>(
    "/api/v1/meetings/blackouts",
    data
  );
  return response.data;
}

export async function deleteBlackout(blackoutId: string): Promise<void> {
  await api.delete(`/api/v1/meetings/blackouts/${blackoutId}`);
}
