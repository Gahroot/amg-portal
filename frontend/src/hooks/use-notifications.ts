
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listNotifications,
  listGroupedNotifications,
  markNotificationRead,
  markGroupRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
  snoozeNotification,
  unsnoozeNotification,
  listSnoozedNotifications,
} from "@/lib/api/notifications";
import type {
  Notification,
  NotificationPreference,
  NotificationPreferenceUpdateData,
  SnoozeDurationPreset,
} from "@/types/communication";

// Notifications
export function useNotifications(params?: { unread_only?: boolean; skip?: number; limit?: number }) {
  return useQuery({
    queryKey: ["notifications", params],
    queryFn: () => listNotifications(params),
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

export function useGroupedNotifications(params?: {
  unread_only?: boolean;
  skip?: number;
  limit?: number;
  group_mode?: "type" | "entity" | "time";
}) {
  return useQuery({
    queryKey: ["notifications", "grouped", params],
    queryFn: () => listGroupedNotifications(params),
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to mark notification as read"),
  });
}

export function useMarkGroupRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupKey, groupMode }: { groupKey: string; groupMode: "type" | "entity" | "time" }) =>
      markGroupRead(groupKey, groupMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to mark group as read"),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to mark all notifications as read"),
  });
}

// Snooze
export function useSnoozedNotifications(skip = 0, limit = 50) {
  return useQuery({
    queryKey: ["notifications", "snoozed", { skip, limit }],
    queryFn: () => listSnoozedNotifications(skip, limit),
    refetchInterval: 60000, // Poll every minute
  });
}

export function useSnoozeNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, durationMinutes }: { id: string; durationMinutes: SnoozeDurationPreset }) =>
      snoozeNotification(id, { snooze_duration_minutes: durationMinutes }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(`Notification snoozed until ${data.snoozed_until ? new Date(data.snoozed_until).toLocaleString() : "later"}`);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to snooze notification"),
  });
}

export function useUnsnoozeNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unsnoozeNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notification unsnoozed");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to unsnooze notification"),
  });
}

// Preferences
export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["notification-preferences"],
    queryFn: getNotificationPreferences,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: NotificationPreferenceUpdateData) =>
      updateNotificationPreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update notification preferences"),
  });
}

// Unread count hook
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const response = await listNotifications({ unread_only: true, limit: 1 });
      return response.total;
    },
    refetchInterval: 30000,
  });
}
