import type { components } from "./generated";

export type Notification = components["schemas"]["NotificationResponse"];
export type NotificationListResponse = components["schemas"]["NotificationListResponse"];
export type NotificationGroup = components["schemas"]["NotificationGroupResponse"];
export type GroupedNotificationsResponse = components["schemas"]["GroupedNotificationsResponse"];

export interface NotificationListParams {
  unread_only?: boolean;
  skip?: number;
  limit?: number;
}
