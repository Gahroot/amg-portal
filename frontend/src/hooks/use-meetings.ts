/** TanStack Query hooks for meeting scheduler. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bookMeeting,
  cancelMeeting,
  confirmMeeting,
  getAvailableSlots,
  listMeetingTypes,
  listMyMeetings,
  listRMMeetings,
  rescheduleMeeting,
  type GetAvailableSlotsParams,
} from "@/lib/api/meetings";
import type {
  MeetingBook,
  MeetingCancelRequest,
  MeetingRescheduleRequest,
} from "@/types/meeting";

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const meetingKeys = {
  all: ["meetings"] as const,
  types: () => [...meetingKeys.all, "types"] as const,
  myList: (params?: object) =>
    [...meetingKeys.all, "my", params] as const,
  rmList: (params?: object) =>
    [...meetingKeys.all, "rm", params] as const,
  slots: (params: GetAvailableSlotsParams) =>
    [...meetingKeys.all, "slots", params] as const,
};

// ─── Meeting Types ─────────────────────────────────────────────────────────────

export function useMeetingTypes() {
  return useQuery({
    queryKey: meetingKeys.types(),
    queryFn: listMeetingTypes,
    staleTime: 5 * 60 * 1000, // types rarely change
  });
}

// ─── Available Slots ──────────────────────────────────────────────────────────

export function useAvailableSlots(
  params: GetAvailableSlotsParams,
  enabled = true
) {
  return useQuery({
    queryKey: meetingKeys.slots(params),
    queryFn: () => getAvailableSlots(params),
    enabled: enabled && !!params.meeting_type_id,
  });
}

// ─── Client: My Meetings ──────────────────────────────────────────────────────

export function useMyMeetings(params?: {
  status?: string;
  skip?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: meetingKeys.myList(params),
    queryFn: () => listMyMeetings(params),
  });
}

// ─── RM: All Meetings ─────────────────────────────────────────────────────────

export function useRMMeetings(params?: {
  status?: string;
  skip?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: meetingKeys.rmList(params),
    queryFn: () => listRMMeetings(params),
  });
}

// ─── Book Meeting ─────────────────────────────────────────────────────────────

export function useBookMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MeetingBook) => bookMeeting(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: meetingKeys.all });
    },
  });
}

// ─── Cancel Meeting ───────────────────────────────────────────────────────────

export function useCancelMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      meetingId,
      data,
    }: {
      meetingId: string;
      data?: MeetingCancelRequest;
    }) => cancelMeeting(meetingId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: meetingKeys.all });
    },
  });
}

// ─── Reschedule Meeting ───────────────────────────────────────────────────────

export function useRescheduleMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      meetingId,
      data,
    }: {
      meetingId: string;
      data: MeetingRescheduleRequest;
    }) => rescheduleMeeting(meetingId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: meetingKeys.all });
    },
  });
}

// ─── Confirm Meeting (RM) ─────────────────────────────────────────────────────

export function useConfirmMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (meetingId: string) => confirmMeeting(meetingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: meetingKeys.all });
    },
  });
}
