
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import type { ScheduledEventCreate, ScheduledEventUpdate } from "@/types/scheduling";

export function useScheduledEvents(params?: {
  skip?: number;
  limit?: number;
  status?: string;
  event_type?: string;
}) {
  return useQuery({
    queryKey: ["scheduled-events", params],
    queryFn: () => listEvents(params),
  });
}

export function useScheduledEvent(id: string) {
  return useQuery({
    queryKey: ["scheduled-events", id],
    queryFn: () => getEvent(id),
    enabled: !!id,
  });
}

export function useMySchedule(start: string, end: string) {
  return useQuery({
    queryKey: ["my-schedule", start, end],
    queryFn: () => getMySchedule(start, end),
    enabled: !!start && !!end,
  });
}

export function useConflictCheck(start: string, end: string) {
  return useQuery({
    queryKey: ["scheduling-conflicts", start, end],
    queryFn: () => checkConflicts(start, end),
    enabled: !!start && !!end,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ScheduledEventCreate) => createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-events"] });
      queryClient.invalidateQueries({ queryKey: ["my-schedule"] });
      toast.success("Event created successfully");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create event"),
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ScheduledEventUpdate }) =>
      updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-events"] });
      queryClient.invalidateQueries({ queryKey: ["my-schedule"] });
      toast.success("Event updated successfully");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update event"),
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-events"] });
      queryClient.invalidateQueries({ queryKey: ["my-schedule"] });
      toast.success("Event deleted");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to delete event"),
  });
}

export function useConfirmEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => confirmEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-events"] });
      queryClient.invalidateQueries({ queryKey: ["my-schedule"] });
      toast.success("Event confirmed");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to confirm event"),
  });
}

export function useCancelEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-events"] });
      queryClient.invalidateQueries({ queryKey: ["my-schedule"] });
      toast.success("Event cancelled");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to cancel event"),
  });
}
