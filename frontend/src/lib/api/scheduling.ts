/** API client for scheduling endpoints. */

import api from "@/lib/api";
import type {
  ScheduledEvent,
  ScheduledEventCreate,
  ScheduledEventUpdate,
  ScheduledEventListResponse,
  ConflictCheckResponse,
} from "@/types/scheduling";

export async function listEvents(params?: {
  skip?: number;
  limit?: number;
  status?: string;
  event_type?: string;
}): Promise<ScheduledEventListResponse> {
  const response = await api.get<ScheduledEventListResponse>(
    "/api/v1/scheduling/events",
    { params }
  );
  return response.data;
}

export async function createEvent(
  data: ScheduledEventCreate
): Promise<ScheduledEvent> {
  const response = await api.post<ScheduledEvent>(
    "/api/v1/scheduling/events",
    data
  );
  return response.data;
}

export async function getEvent(eventId: string): Promise<ScheduledEvent> {
  const response = await api.get<ScheduledEvent>(
    `/api/v1/scheduling/events/${eventId}`
  );
  return response.data;
}

export async function updateEvent(
  eventId: string,
  data: ScheduledEventUpdate
): Promise<ScheduledEvent> {
  const response = await api.patch<ScheduledEvent>(
    `/api/v1/scheduling/events/${eventId}`,
    data
  );
  return response.data;
}

export async function deleteEvent(eventId: string): Promise<void> {
  await api.delete(`/api/v1/scheduling/events/${eventId}`);
}

export async function getMySchedule(
  start: string,
  end: string
): Promise<ScheduledEventListResponse> {
  const response = await api.get<ScheduledEventListResponse>(
    "/api/v1/scheduling/my-schedule",
    { params: { start, end } }
  );
  return response.data;
}

export async function checkConflicts(
  start: string,
  end: string
): Promise<ConflictCheckResponse> {
  const response = await api.get<ConflictCheckResponse>(
    "/api/v1/scheduling/conflicts",
    { params: { start, end } }
  );
  return response.data;
}

export async function confirmEvent(
  eventId: string
): Promise<ScheduledEvent> {
  const response = await api.post<ScheduledEvent>(
    `/api/v1/scheduling/events/${eventId}/confirm`
  );
  return response.data;
}

export async function cancelEvent(
  eventId: string
): Promise<ScheduledEvent> {
  const response = await api.post<ScheduledEvent>(
    `/api/v1/scheduling/events/${eventId}/cancel`
  );
  return response.data;
}
