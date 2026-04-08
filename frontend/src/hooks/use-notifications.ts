
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listNotifications,
  listGroupedNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markGroupRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
  snoozeNotification,
  unsnoozeNotification,
  listSnoozedNotifications,
} from "@/lib/api/notifications";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  NotificationPreferenceUpdateData,
  SnoozeDurationPreset,
} from "@/types/communication";

// Notifications
export function useNotifications(params?: { unread_only?: boolean; skip?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => listNotifications(params),
    refetchOnWindowFocus: true,
  });
}

export function useGroupedNotifications(params?: {
  unread_only?: boolean;
  skip?: number;
  limit?: number;
  group_mode?: "type" | "entity" | "time";
}) {
  return useQuery({
    queryKey: queryKeys.notifications.grouped(params),
    queryFn: () => listGroupedNotifications(params),
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  return useCrudMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    invalidateKeys: [queryKeys.notifications.all],
    errorMessage: "Failed to mark notification as read",
  });
}

export function useMarkGroupRead() {
  return useCrudMutation({
    mutationFn: ({ groupKey, groupMode }: { groupKey: string; groupMode: "type" | "entity" | "time" }) =>
      markGroupRead(groupKey, groupMode),
    invalidateKeys: [queryKeys.notifications.all],
    errorMessage: "Failed to mark group as read",
  });
}

export function useMarkAllNotificationsRead() {
  return useCrudMutation<Awaited<ReturnType<typeof markAllNotificationsRead>>, void>({
    mutationFn: () => markAllNotificationsRead(),
    invalidateKeys: [queryKeys.notifications.all],
    errorMessage: "Failed to mark all notifications as read",
  });
}

// Snooze
export function useSnoozedNotifications(skip = 0, limit = 50) {
  return useQuery({
    queryKey: queryKeys.notifications.snoozed({ skip, limit }),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      toast.success(`Notification snoozed until ${data.snoozed_until ? new Date(data.snoozed_until).toLocaleString() : "later"}`);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to snooze notification"),
  });
}

export function useUnsnoozeNotification() {
  return useCrudMutation({
    mutationFn: (id: string) => unsnoozeNotification(id),
    invalidateKeys: [queryKeys.notifications.all],
    successMessage: "Notification unsnoozed",
    errorMessage: "Failed to unsnooze notification",
  });
}

// Preferences
export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notifications.preferences(),
    queryFn: getNotificationPreferences,
  });
}

export function useUpdateNotificationPreferences() {
  return useCrudMutation({
    mutationFn: (data: NotificationPreferenceUpdateData) =>
      updateNotificationPreferences(data),
    invalidateKeys: [queryKeys.notifications.preferences()],
    errorMessage: "Failed to update notification preferences",
  });
}

// Unread count hook — calls the dedicated /unread-count endpoint
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => getUnreadNotificationCount(),
    refetchOnWindowFocus: true,
  });
}
