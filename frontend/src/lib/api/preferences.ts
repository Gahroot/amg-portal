/**
 * API client for user preferences and multi-device sync
 */

import api from "@/lib/api";
import type {
  UserPreferencesResponse,
  UserPreferencesUpdateRequest,
  UserPreferencesSyncResponse,
  ReadStatusResponse,
  ReadStatusUpdateRequest,
  SyncPushRequest,
  SyncPushResponse,
  SyncPullResponse,
  SyncStatusResponse,
  DeviceRegisterRequest,
  DeviceSessionResponse,
  DeviceListResponse,
} from "@/types/preferences";

// ============================================================================
// User Preferences
// ============================================================================

/**
 * Get the current user's preferences
 */
export async function getUserPreferences(): Promise<UserPreferencesResponse> {
  const response = await api.get<UserPreferencesResponse>("/api/v1/user/preferences");
  return response.data;
}

/**
 * Update user preferences with optimistic locking
 */
export async function updateUserPreferences(
  data: UserPreferencesUpdateRequest,
  deviceId?: string
): Promise<UserPreferencesSyncResponse> {
  const params = deviceId ? { device_id: deviceId } : {};
  const response = await api.patch<UserPreferencesSyncResponse>(
    "/api/v1/user/preferences",
    data,
    { params }
  );
  return response.data;
}

/**
 * Push local changes and pull remote changes (full sync)
 */
export async function syncPreferences(
  request: SyncPushRequest
): Promise<SyncPullResponse> {
  const response = await api.post<SyncPullResponse>(
    "/api/v1/user/preferences/sync",
    request
  );
  return response.data;
}

/**
 * Push changes from client to server only
 */
export async function pushChanges(
  request: SyncPushRequest
): Promise<SyncPushResponse> {
  const response = await api.post<SyncPushResponse>(
    "/api/v1/user/preferences/push",
    request
  );
  return response.data;
}

/**
 * Pull changes from server to client only
 */
export async function pullChanges(
  deviceId: string,
  sinceVersion?: number
): Promise<SyncPullResponse> {
  const params: Record<string, string | number> = { device_id: deviceId };
  if (sinceVersion !== undefined) {
    params.since_version = sinceVersion;
  }
  const response = await api.post<SyncPullResponse>(
    "/api/v1/user/preferences/pull",
    null,
    { params }
  );
  return response.data;
}

/**
 * Get the current sync status
 */
export async function getSyncStatus(): Promise<SyncStatusResponse> {
  const response = await api.get<SyncStatusResponse>(
    "/api/v1/user/preferences/status"
  );
  return response.data;
}

// ============================================================================
// Read Status
// ============================================================================

/**
 * Update read status for a single entity
 */
export async function updateReadStatus(
  update: ReadStatusUpdateRequest
): Promise<ReadStatusResponse> {
  const response = await api.post<ReadStatusResponse>(
    "/api/v1/user/read-status",
    update
  );
  return response.data;
}

/**
 * Batch update read statuses
 */
export async function batchUpdateReadStatus(
  updates: ReadStatusUpdateRequest[]
): Promise<ReadStatusResponse[]> {
  const response = await api.post<ReadStatusResponse[]>(
    "/api/v1/user/read-status/batch",
    { updates }
  );
  return response.data;
}

/**
 * Get read status for a specific entity
 */
export async function getReadStatus(
  entityType: string,
  entityId: string
): Promise<ReadStatusResponse> {
  const response = await api.get<ReadStatusResponse>(
    `/api/v1/user/read-status/${entityType}/${entityId}`
  );
  return response.data;
}

// ============================================================================
// Device Management
// ============================================================================

/**
 * Register or update a device session
 */
export async function registerDevice(
  request: DeviceRegisterRequest
): Promise<DeviceSessionResponse> {
  const response = await api.post<DeviceSessionResponse>(
    "/api/v1/user/devices/register",
    request
  );
  return response.data;
}

/**
 * List all devices for the current user
 */
export async function listDevices(
  currentDeviceId?: string
): Promise<DeviceListResponse> {
  const params = currentDeviceId ? { current_device_id: currentDeviceId } : {};
  const response = await api.get<DeviceListResponse>("/api/v1/user/devices", {
    params,
  });
  return response.data;
}

/**
 * Deactivate a device session
 */
export async function deactivateDevice(deviceId: string): Promise<void> {
  await api.delete(`/api/v1/user/devices/${deviceId}`);
}
