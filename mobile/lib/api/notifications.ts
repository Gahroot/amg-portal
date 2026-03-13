import api from '@/lib/api';
import type { NotificationListResponse, NotificationPreference, NotificationPreferenceUpdateData, PushToken, PushTokenListResponse } from '@/types/notification';

export async function listNotifications(params?: { skip?: number; limit?: number; is_read?: boolean }): Promise<NotificationListResponse> {
  const res = await api.get<NotificationListResponse>('/notifications', { params });
  return res.data;
}

export async function getUnreadCount(): Promise<number> {
  const res = await api.get<NotificationListResponse>('/notifications', {
    params: { unread_only: true, limit: 0 },
  });
  return res.data.total;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/mark-all-read');
}

export async function getNotificationPreferences(): Promise<NotificationPreference> {
  const res = await api.get<NotificationPreference>('/notifications/preferences');
  return res.data;
}

export async function updateNotificationPreferences(data: NotificationPreferenceUpdateData): Promise<NotificationPreference> {
  const res = await api.patch<NotificationPreference>('/notifications/preferences', data);
  return res.data;
}

export async function registerPushToken(token: string, platform: string): Promise<PushToken> {
  const res = await api.post<PushToken>('/push-tokens', { token, platform });
  return res.data;
}

export async function unregisterPushToken(token: string): Promise<void> {
  await api.delete(`/push-tokens/${token}`);
}

export async function getPushTokens(): Promise<PushTokenListResponse> {
  const res = await api.get<PushTokenListResponse>('/push-tokens');
  return res.data;
}
