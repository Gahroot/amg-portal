import api from "@/lib/api";
import type {
  Notification,
  NotificationListResponse,
  NotificationPreference,
  NotificationPreferenceUpdateData,
} from "@/types/communication";

export interface NotificationListParams {
  unread_only?: boolean;
  skip?: number;
  limit?: number;
}

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

export async function markNotificationRead(id: string): Promise<Notification> {
  const response = await api.patch<Notification>(
    `/api/v1/notifications/${id}/read`
  );
  return response.data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/api/v1/notifications/mark-all-read");
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
