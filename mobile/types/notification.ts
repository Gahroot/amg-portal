export type NotificationType =
  | 'communication'
  | 'decision_pending'
  | 'assignment_update'
  | 'deliverable_ready'
  | 'milestone_update'
  | 'approval_required'
  | 'system';

export type DigestFrequency = 'immediate' | 'hourly' | 'daily' | 'weekly' | 'never';

export interface Notification {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  action_url?: string;
  action_label?: string;
  entity_type?: string;
  entity_id?: string;
  priority: string;
  is_read: boolean;
  read_at?: string;
  email_delivered: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  digest_enabled: boolean;
  digest_frequency: DigestFrequency;
  notification_type_preferences?: Record<string, string>;
  channel_preferences?: Record<string, boolean>;
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferenceUpdateData {
  digest_enabled?: boolean;
  digest_frequency?: DigestFrequency;
  notification_type_preferences?: Record<string, string>;
  channel_preferences?: Record<string, boolean>;
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  timezone?: string;
}

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  device_name?: string;
  is_active: boolean;
  last_used_at?: string;
  created_at: string;
}

export interface PushTokenListResponse {
  tokens: PushToken[];
  total: number;
}
