import api from "@/lib/api";
import type {
  UserNotificationPreferences,
  UserNotificationPreferencesUpdate,
} from "@/types/user";

export async function getNotificationPreferences(): Promise<UserNotificationPreferences> {
  const response = await api.get<UserNotificationPreferences>("/api/v1/notifications/preferences");
  return response.data;
}

export async function updateNotificationPreferences(
  data: UserNotificationPreferencesUpdate
): Promise<UserNotificationPreferences> {
  const response = await api.patch<UserNotificationPreferences>("/api/v1/notifications/preferences", data);
  return response.data;
}

export const notificationCategories = {
  sla_warning: "SLA breach warnings",
  document_delivery: "New documents delivered",
  approval_request: "Approvals pending",
  escalation: "Escalations created/updated",
  milestone: "Milestone updates",
  message: "New messages",
  decision: "Decision requests",
  program_update: "Program status changes",
  partner_assignment: "Partner assignments (for partners)",
  communication: "Communications & messages",
  deliverable_ready: "Deliverable ready",
  assignment_update: "Assignment updates",
  milestone_alert: "Milestone alerts",
  weekly_status: "Weekly status reports",
  system: "System alerts",
} as const;

export type NotificationCategoryKey = keyof typeof notificationCategories;

export const NOTIFICATION_CHANNELS = {
  push: "Push",
  email: "Email",
  in_app: "In-App",
} as const;

export type NotificationChannelKey = keyof typeof NOTIFICATION_CHANNELS;

export const ALL_CHANNEL_KEYS: NotificationChannelKey[] = ["push", "email", "in_app"];

/** Build default granular preferences with all categories and channels enabled */
export function buildDefaultGranularPreferences(): Record<string, Record<string, boolean>> {
  const defaults: Record<string, Record<string, boolean>> = {};
  for (const key of Object.keys(notificationCategories)) {
    defaults[key] = { push: true, email: true, in_app: true };
  }
  return defaults;
}
