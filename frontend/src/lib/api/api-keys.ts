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
import { createApiClient } from "./factory";

const keysApi = createApiClient<APIKey, APIKeyListResponse, APIKeyCreateRequest>(
  "/api/v1/api-keys"
);

export const listAPIKeys = keysApi.list as (params?: {
  include_inactive?: boolean;
  limit?: number;
  offset?: number;
}) => Promise<APIKeyListResponse>;
export const getAPIKey = keysApi.get;
export const deleteAPIKey = keysApi.delete;

// create returns APIKeyCreated (with the plain key), not APIKey
export async function createAPIKey(data: APIKeyCreateRequest): Promise<APIKeyCreated> {
  const response = await api.post<APIKeyCreated>("/api/v1/api-keys", data);
  return response.data;
}

// Custom endpoints

export async function getAPIScopes(): Promise<ScopesResponse> {
  const response = await api.get<ScopesResponse>("/api/v1/api-keys/scopes");
  return response.data;
}

export async function revokeAPIKey(keyId: string): Promise<APIKey> {
  const response = await api.post<APIKey>(`/api/v1/api-keys/${keyId}/revoke`);
  return response.data;
}

export async function regenerateAPIKey(keyId: string): Promise<APIKeyCreated> {
  const response = await api.post<APIKeyCreated>(`/api/v1/api-keys/${keyId}/regenerate`);
  return response.data;
}
