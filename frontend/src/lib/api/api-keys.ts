/**
 * API client for API key management.
 */

import api from "@/lib/api";
import type {
  APIKey,
  APIKeyCreated,
  APIKeyCreateRequest,
  APIKeyListResponse,
  ScopesResponse,
} from "@/types/api-key";

/**
 * Get all available API key scopes
 */
export async function getAPIScopes(): Promise<ScopesResponse> {
  const response = await api.get<ScopesResponse>("/api/v1/api-keys/scopes");
  return response.data;
}

/**
 * List all API keys for the current user
 */
export async function listAPIKeys(params?: {
  include_inactive?: boolean;
  limit?: number;
  offset?: number;
}): Promise<APIKeyListResponse> {
  const response = await api.get<APIKeyListResponse>("/api/v1/api-keys", {
    params,
  });
  return response.data;
}

/**
 * Get a specific API key by ID
 */
export async function getAPIKey(keyId: string): Promise<APIKey> {
  const response = await api.get<APIKey>(`/api/v1/api-keys/${keyId}`);
  return response.data;
}

/**
 * Create a new API key
 * @returns The created API key with the plain key (shown only once!)
 */
export async function createAPIKey(data: APIKeyCreateRequest): Promise<APIKeyCreated> {
  const response = await api.post<APIKeyCreated>("/api/v1/api-keys", data);
  return response.data;
}

/**
 * Revoke an API key
 */
export async function revokeAPIKey(keyId: string): Promise<APIKey> {
  const response = await api.post<APIKey>(`/api/v1/api-keys/${keyId}/revoke`);
  return response.data;
}

/**
 * Regenerate an API key (revokes old, creates new)
 * @returns The new API key with the plain key (shown only once!)
 */
export async function regenerateAPIKey(keyId: string): Promise<APIKeyCreated> {
  const response = await api.post<APIKeyCreated>(`/api/v1/api-keys/${keyId}/regenerate`);
  return response.data;
}

/**
 * Permanently delete an API key
 */
export async function deleteAPIKey(keyId: string): Promise<void> {
  await api.delete(`/api/v1/api-keys/${keyId}`);
}
