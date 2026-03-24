/**
 * Types for user preferences and multi-device sync
 */

/**
 * User interface preferences that sync across devices
 */
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

/**
 * Default UI preferences
 */
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

/**
 * Partial update for UI preferences
 */
export type UIPreferencesUpdate = Partial<UIPreferences>;

/**
 * Dashboard configuration summary for sync
 */
export interface DashboardConfigSummary {
  layout_mode: string;
  columns: number;
  widgets: Array<Record<string, unknown>>;
}

/**
 * Full user preferences response from server
 */
export interface UserPreferencesResponse {
  id: string;
  user_id: string;
  ui_preferences: UIPreferences;
  notification_preferences: unknown | null;
  dashboard_config: DashboardConfigSummary | null;
  sync_enabled: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

/**
 * Request to update user preferences
 */
export interface UserPreferencesUpdateRequest {
  ui_preferences?: UIPreferencesUpdate;
  sync_enabled?: boolean;
  version: number;
}

/**
 * Conflict resolution information
 */
export interface ConflictResolution {
  server_version: number;
  client_version: number;
  server_updated_at: string;
  conflict_fields: string[];
  resolution_strategy: "server_wins" | "client_wins" | "merge";
}

/**
 * Response for preferences sync operation
 */
export interface UserPreferencesSyncResponse {
  preferences: UserPreferencesResponse;
  conflict: ConflictResolution | null;
  synced_at: string;
}

/**
 * Read status for an entity
 */
export interface ReadStatusResponse {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  is_read: boolean;
  read_at: string | null;
  updated_at: string;
}

/**
 * Request to update read status
 */
export interface ReadStatusUpdateRequest {
  entity_type: string;
  entity_id: string;
  is_read: boolean;
  device_id?: string;
}

/**
 * Sync action types
 */
export type SyncAction =
  | "mark_read"
  | "mark_unread"
  | "update_preference"
  | "update_ui_preference";

/**
 * Entity types that can be synced
 */
export type EntityType =
  | "program"
  | "document"
  | "deliverable"
  | "notification"
  | "task"
  | "message"
  | "preference";

/**
 * A single change to be synced
 */
export interface SyncChange {
  entity_type: string;
  entity_id?: string;
  action: SyncAction;
  payload: Record<string, unknown> | UIPreferencesUpdate;
  client_timestamp: string;
  device_id?: string;
}

/**
 * Request to push changes from client to server
 */
export interface SyncPushRequest {
  device_id: string;
  changes: SyncChange[];
  client_version: number;
  last_synced_at?: string;
}

/**
 * Response after pushing changes
 */
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

/**
 * Response for pulling changes from server
 */
export interface SyncPullResponse {
  server_version: number;
  preferences: UserPreferencesResponse;
  read_statuses: ReadStatusResponse[];
  pending_changes?: SyncChange[];
  synced_at: string;
}

/**
 * Device session information
 */
export interface DeviceSessionResponse {
  id: string;
  device_id: string;
  device_type: "web" | "ios" | "android";
  device_name: string | null;
  last_seen_at: string;
  is_active: boolean;
  app_version: string | null;
}

/**
 * Request to register a device
 */
export interface DeviceRegisterRequest {
  device_id: string;
  device_type: "web" | "ios" | "android";
  device_name?: string;
  user_agent?: string;
  app_version?: string;
}

/**
 * List of user's devices
 */
export interface DeviceListResponse {
  devices: DeviceSessionResponse[];
  current_device_id: string | null;
  total: number;
}

/**
 * Current sync status for the user
 */
export interface SyncStatusResponse {
  is_syncing: boolean;
  last_synced_at: string | null;
  pending_changes: number;
  server_version: number;
  sync_enabled: boolean;
  connected_devices: number;
}

/**
 * Local sync state managed by the store
 */
export interface SyncState {
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  pendingChanges: number;
  conflictDetected: boolean;
  conflict: ConflictResolution | null;
  isOnline: boolean;
}

/**
 * Queued offline change
 */
export interface QueuedChange {
  id: string;
  change: SyncChange;
  queuedAt: Date;
}
