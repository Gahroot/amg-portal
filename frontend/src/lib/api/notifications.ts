import api from "@/lib/api";
import type {
  NotificationPreference,
  NotificationPreferenceUpdateData,
  SnoozeRequestData,
} from "@/types/communication";
import type {
  Notification,
  NotificationListResponse,
  GroupedNotificationsResponse,
  NotificationListParams,
} from "@/types/notification";

export type { NotificationListParams };

// Notifications
export async function listNotifications(
  params?: NotificationListParams
): Promise<NotificationListResponse> {
  const response = await api.get<NotificationListResponse>(
    "/api/v1/notifications/",
    { params }
  );
  return response.data;
}

export async function listGroupedNotifications(
  params?: NotificationListParams & { group_mode?: "type" | "entity" | "time" }
): Promise<GroupedNotificationsResponse> {
  const response = await api.get<GroupedNotificationsResponse>(
    "/api/v1/notifications/grouped",
    { params }
  );
  return response.data;
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const response = await api.patch<Notification>(
    `/api/v1/notifications/${id}/read`
  );
  return response.data;
}

export async function markGroupRead(
  groupKey: string,
  groupMode: "type" | "entity" | "time"
): Promise<void> {
  await api.post(`/api/v1/notifications/groups/${encodeURIComponent(groupKey)}/mark-read`, {
    group_mode: groupMode,
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/api/v1/notifications/mark-all-read");
}

export async function getUnreadNotificationCount(): Promise<number> {
  const response = await api.get<{ unread_count: number }>(
    "/api/v1/notifications/unread-count"
  );
  return response.data.unread_count;
}

// Snooze
export async function snoozeNotification(
  id: string,
  data: SnoozeRequestData
): Promise<Notification> {
  const response = await api.post<Notification>(
    `/api/v1/notifications/${id}/snooze`,
    data
  );
  return response.data;
}

export async function unsnoozeNotification(id: string): Promise<Notification> {
  const response = await api.delete<Notification>(
    `/api/v1/notifications/${id}/snooze`
  );
  return response.data;
}

export async function listSnoozedNotifications(
  skip = 0,
  limit = 50
): Promise<NotificationListResponse> {
  const response = await api.get<NotificationListResponse>(
    "/api/v1/notifications/snoozed",
    { params: { skip, limit } }
  );
  return response.data;
}

// Preferences
export async function getNotificationPreferences(): Promise<NotificationPreference> {
  const response = await api.get<NotificationPreference>(
    "/api/v1/notifications/preferences"
  );
  return response.data;
}

export async function updateNotificationPreferences(
  data: NotificationPreferenceUpdateData
): Promise<NotificationPreference> {
  const response = await api.patch<NotificationPreference>(
    "/api/v1/notifications/preferences",
    data
  );
  return response.data;
}
