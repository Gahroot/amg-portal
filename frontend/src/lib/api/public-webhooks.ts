/**
 * API client for public webhook endpoints (Zapier/Make integrations).
 *
 * These endpoints use X-API-Key authentication (not JWT) because they are
 * designed for external systems. The API key must be provided explicitly.
 */

import api from "@/lib/api";

// Types matching backend PublicWebhookResponse / PublicWebhookCreate schemas

export interface PublicWebhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicWebhookListResponse {
  webhooks: PublicWebhook[];
  total: number;
}

export interface PublicWebhookCreateRequest {
  url: string;
  events: string[];
  description?: string;
}

/** Build the X-API-Key header for public API calls. */
function apiKeyHeaders(apiKey: string) {
  return { "X-API-Key": apiKey };
}

/**
 * List all public webhook subscriptions for the authenticated API key user.
 */
export async function listPublicWebhooks(
  apiKey: string,
): Promise<PublicWebhookListResponse> {
  const response = await api.get<PublicWebhookListResponse>(
    "/api/v1/public/webhooks",
    { headers: apiKeyHeaders(apiKey) },
  );
  return response.data;
}

/**
 * Create a new public webhook subscription.
 * The returned object includes the `secret` (shown only once).
 */
export async function createPublicWebhook(
  apiKey: string,
  data: PublicWebhookCreateRequest,
): Promise<PublicWebhook> {
  const response = await api.post<PublicWebhook>(
    "/api/v1/public/webhooks",
    data,
    { headers: apiKeyHeaders(apiKey) },
  );
  return response.data;
}

/**
 * Delete a public webhook subscription.
 */
export async function deletePublicWebhook(
  apiKey: string,
  webhookId: string,
): Promise<void> {
  await api.delete(`/api/v1/public/webhooks/${webhookId}`, {
    headers: apiKeyHeaders(apiKey),
  });
}
