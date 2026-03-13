"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listReportSchedules,
  createReportSchedule,
  updateReportSchedule,
  deleteReportSchedule,
  getClientPreferences,
  updateClientPreferences,
  getEngagementHistory,
  getPortalProfilePreferences,
  updatePortalProfilePreferences,
  getPortalIntelligence,
  updatePortalIntelligence,
} from "@/lib/api/schedules";
import type {
  ReportScheduleCreate,
  ReportScheduleUpdate,
  ClientPreferencesUpdate,
  PortalProfilePreferencesUpdate,
  PortalIntelligenceUpdate,
} from "@/lib/api/schedules";

export function useReportSchedules() {
  return useQuery({
    queryKey: ["report-schedules"],
    queryFn: listReportSchedules,
  });
}

export function useCreateReportSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReportScheduleCreate) => createReportSchedule(data),
    onSuccess: () => {
      toast.success("Report schedule created");
      queryClient.invalidateQueries({ queryKey: ["report-schedules"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to create schedule";
      toast.error(message);
    },
  });
}

export function useUpdateReportSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReportScheduleUpdate }) =>
      updateReportSchedule(id, data),
    onSuccess: () => {
      toast.success("Report schedule updated");
      queryClient.invalidateQueries({ queryKey: ["report-schedules"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to update schedule";
      toast.error(message);
    },
  });
}

export function useDeleteReportSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteReportSchedule(id),
    onSuccess: () => {
      toast.success("Report schedule deleted");
      queryClient.invalidateQueries({ queryKey: ["report-schedules"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to delete schedule";
      toast.error(message);
    },
  });
}

export function useClientPreferences() {
  return useQuery({
    queryKey: ["client-preferences"],
    queryFn: getClientPreferences,
  });
}

export function useUpdateClientPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClientPreferencesUpdate) => updateClientPreferences(data),
    onSuccess: () => {
      toast.success("Preferences updated");
      queryClient.invalidateQueries({ queryKey: ["client-preferences"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to update preferences";
      toast.error(message);
    },
  });
}

export function useEngagementHistory() {
  return useQuery({
    queryKey: ["engagement-history"],
    queryFn: getEngagementHistory,
  });
}

export function usePortalProfilePreferences() {
  return useQuery({
    queryKey: ["portal-profile-preferences"],
    queryFn: getPortalProfilePreferences,
  });
}

export function useUpdatePortalProfilePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PortalProfilePreferencesUpdate) =>
      updatePortalProfilePreferences(data),
    onSuccess: () => {
      toast.success("Profile preferences updated");
      queryClient.invalidateQueries({ queryKey: ["portal-profile-preferences"] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Failed to update profile preferences";
      toast.error(message);
    },
  });
}

export function usePortalIntelligence() {
  return useQuery({
    queryKey: ["portal-intelligence"],
    queryFn: getPortalIntelligence,
  });
}

export function useUpdatePortalIntelligence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PortalIntelligenceUpdate) => updatePortalIntelligence(data),
    onSuccess: () => {
      toast.success("Intelligence profile updated");
      queryClient.invalidateQueries({ queryKey: ["portal-intelligence"] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Failed to update intelligence profile";
      toast.error(message);
    },
  });
}
