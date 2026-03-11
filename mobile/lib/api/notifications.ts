import api from '@/lib/api';
import type { NotificationListResponse, NotificationPreference, NotificationPreferenceUpdateData } from '@/types/notification';

export async function listNotifications(params?: { skip?: number; limit?: number; is_read?: boolean }): Promise<NotificationListResponse> {
  const res = await api.get<NotificationListResponse>('/notifications', { params });
  return res.data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read-all');
}

export async function getNotificationPreferences(): Promise<NotificationPreference> {
  const res = await api.get<NotificationPreference>('/notifications/preferences');
  return res.data;
}

export async function updateNotificationPreferences(data: NotificationPreferenceUpdateData): Promise<NotificationPreference> {
  const res = await api.put<NotificationPreference>('/notifications/preferences', data);
  return res.data;
}
