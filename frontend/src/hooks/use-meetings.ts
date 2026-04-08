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
import { queryKeys } from "@/lib/query-keys";
import type {
  MeetingBook,
  MeetingCancelRequest,
  MeetingRescheduleRequest,
} from "@/types/meeting";

// Re-export for backward compat if anything imports meetingKeys
export const meetingKeys = queryKeys.meetings;

// ─── Meeting Types ─────────────────────────────────────────────────────────────

export function useMeetingTypes() {
  return useQuery({
    queryKey: queryKeys.meetings.types(),
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
    queryKey: queryKeys.meetings.slots(params),
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
    queryKey: queryKeys.meetings.myList(params),
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
    queryKey: queryKeys.meetings.rmList(params),
    queryFn: () => listRMMeetings(params),
  });
}

// ─── Book Meeting ─────────────────────────────────────────────────────────────

export function useBookMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MeetingBook) => bookMeeting(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all });
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all });
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all });
    },
  });
}

// ─── Confirm Meeting (RM) ─────────────────────────────────────────────────────

export function useConfirmMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (meetingId: string) => confirmMeeting(meetingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all });
    },
  });
}
