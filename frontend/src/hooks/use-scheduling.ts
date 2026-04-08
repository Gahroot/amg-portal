
import { useQuery } from "@tanstack/react-query";
import {
  listEvents,
  createEvent,
  getEvent,
  updateEvent,
  deleteEvent,
  getMySchedule,
  checkConflicts,
  confirmEvent,
  cancelEvent,
} from "@/lib/api/scheduling";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type { ScheduledEventCreate, ScheduledEventUpdate } from "@/types/scheduling";

export function useScheduledEvents(params?: {
  skip?: number;
  limit?: number;
  status?: string;
  event_type?: string;
}) {
  return useQuery({
    queryKey: queryKeys.scheduling.list(params),
    queryFn: () => listEvents(params),
  });
}

export function useScheduledEvent(id: string) {
  return useQuery({
    queryKey: queryKeys.scheduling.detail(id),
    queryFn: () => getEvent(id),
    enabled: !!id,
  });
}

export function useMySchedule(start: string, end: string) {
  return useQuery({
    queryKey: queryKeys.scheduling.mySchedule(start, end),
    queryFn: () => getMySchedule(start, end),
    enabled: !!start && !!end,
  });
}

export function useConflictCheck(start: string, end: string) {
  return useQuery({
    queryKey: queryKeys.scheduling.conflicts(start, end),
    queryFn: () => checkConflicts(start, end),
    enabled: !!start && !!end,
  });
}

export function useCreateEvent() {
  return useCrudMutation({
    mutationFn: (data: ScheduledEventCreate) => createEvent(data),
    invalidateKeys: [queryKeys.scheduling.all],
    successMessage: "Event created successfully",
    errorMessage: "Failed to create event",
  });
}

export function useUpdateEvent() {
  return useCrudMutation({
    mutationFn: ({ id, data }: { id: string; data: ScheduledEventUpdate }) =>
      updateEvent(id, data),
    invalidateKeys: [queryKeys.scheduling.all],
    successMessage: "Event updated successfully",
    errorMessage: "Failed to update event",
  });
}

export function useDeleteEvent() {
  return useCrudMutation({
    mutationFn: (id: string) => deleteEvent(id),
    invalidateKeys: [queryKeys.scheduling.all],
    successMessage: "Event deleted",
    errorMessage: "Failed to delete event",
  });
}

export function useConfirmEvent() {
  return useCrudMutation({
    mutationFn: (id: string) => confirmEvent(id),
    invalidateKeys: [queryKeys.scheduling.all],
    successMessage: "Event confirmed",
    errorMessage: "Failed to confirm event",
  });
}

export function useCancelEvent() {
  return useCrudMutation({
    mutationFn: (id: string) => cancelEvent(id),
    invalidateKeys: [queryKeys.scheduling.all],
    successMessage: "Event cancelled",
    errorMessage: "Failed to cancel event",
  });
}
