/** API client for scheduling endpoints. */

import api from "@/lib/api";
import type {
  ScheduledEvent,
  ScheduledEventCreate,
  ScheduledEventUpdate,
  ScheduledEventListResponse,
  ConflictCheckResponse,
} from "@/types/scheduling";
import { createApiClient } from "./factory";

const eventsApi = createApiClient<
  ScheduledEvent,
  ScheduledEventListResponse,
  ScheduledEventCreate,
  ScheduledEventUpdate
>("/api/v1/scheduling/events");

export const listEvents = eventsApi.list as (params?: {
  skip?: number;
  limit?: number;
  status?: string;
  event_type?: string;
}) => Promise<ScheduledEventListResponse>;

export const getEvent = eventsApi.get;
export const createEvent = eventsApi.create;
export const updateEvent = eventsApi.update;
export const deleteEvent = eventsApi.delete;

// Custom endpoints

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
