/**
 * User preferences types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/user_preferences.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type UserPreferencesResponse = components["schemas"]["UserPreferencesResponse"];
export type UserPreferencesSyncResponse = components["schemas"]["UserPreferencesSyncResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — UI preferences, sync state, device management
// ---------------------------------------------------------------------------

export interface UIPreferences {
  theme: "light" | "dark" | "system";
  sidebar_collapsed: boolean;
  density: "comfortable" | "compact";
  language: string;
  date_format: string;
  time_format: "12h" | "24h";
  page_sizes: Record<string, number>;
  column_visibility: Record<string, Record<string, boolean>>;
}

export const defaultUIPreferences: UIPreferences = {
  theme: "system",
  sidebar_collapsed: false,
  density: "comfortable",
  language: "en",
  date_format: "MM/DD/YYYY",
  time_format: "12h",
  page_sizes: {},
  column_visibility: {},
};

export type UIPreferencesUpdate = Partial<UIPreferences>;

export interface DashboardConfigSummary {
  layout_mode: string;
  columns: number;
  widgets: Array<Record<string, unknown>>;
}

export interface UserPreferencesUpdateRequest {
  ui_preferences?: UIPreferencesUpdate;
  sync_enabled?: boolean;
  version: number;
}

export interface ConflictResolution {
  server_version: number;
  client_version: number;
  server_updated_at: string;
  conflict_fields: string[];
  resolution_strategy: "server_wins" | "client_wins" | "merge";
}

export interface ReadStatusResponse {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  is_read: boolean;
  read_at: string | null;
  updated_at: string;
}

export interface ReadStatusUpdateRequest {
  entity_type: string;
  entity_id: string;
  is_read: boolean;
  device_id?: string;
}

export type SyncAction =
  | "mark_read"
  | "mark_unread"
  | "update_preference"
  | "update_ui_preference";

export type EntityType =
  | "program"
  | "document"
  | "deliverable"
  | "notification"
  | "task"
  | "message"
  | "preference";

export interface SyncChange {
  entity_type: string;
  entity_id?: string;
  action: SyncAction;
  payload: Record<string, unknown> | UIPreferencesUpdate;
  client_timestamp: string;
  device_id?: string;
}

export interface SyncPushRequest {
  device_id: string;
  changes: SyncChange[];
  client_version: number;
  last_synced_at?: string;
}

export interface SyncPushResponse {
  success: boolean;
  server_version: number;
  processed_changes: number;
  failed_changes?: Array<{
    entity_type: string;
    entity_id: string | null;
    action: string;
    error: string;
  }>;
  synced_at: string;
}

export interface SyncPullResponse {
  server_version: number;
  preferences: UserPreferencesResponse;
  read_statuses: ReadStatusResponse[];
  pending_changes?: SyncChange[];
  synced_at: string;
}

export interface DeviceSessionResponse {
  id: string;
  device_id: string;
  device_type: "web" | "ios" | "android";
  device_name: string | null;
  last_seen_at: string;
  is_active: boolean;
  app_version: string | null;
}

export interface DeviceRegisterRequest {
  device_id: string;
  device_type: "web" | "ios" | "android";
  device_name?: string;
  user_agent?: string;
  app_version?: string;
}

export interface DeviceListResponse {
  devices: DeviceSessionResponse[];
  current_device_id: string | null;
  total: number;
}

export interface SyncStatusResponse {
  is_syncing: boolean;
  last_synced_at: string | null;
  pending_changes: number;
  server_version: number;
  sync_enabled: boolean;
  connected_devices: number;
}

export interface SyncState {
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  pendingChanges: number;
  conflictDetected: boolean;
  conflict: ConflictResolution | null;
  isOnline: boolean;
}

export interface QueuedChange {
  id: string;
  change: SyncChange;
  queuedAt: Date;
}
