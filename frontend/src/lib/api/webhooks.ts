import api from "@/lib/api";
import { createApiClient } from "./factory";

// Types
export interface WebhookEventType {
  type: string;
  description: string;
}

export interface Webhook {
  id: string;
  partner_id: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  failure_count: number;
  description: string | null;
  created_at: string;
  updated_at: string;
  secret_hint: string | null;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: string;
  status_code: number | null;
  response_body: string | null;
  error_message: string | null;
  success: boolean;
  attempt_number: number;
  duration_ms: number | null;
  created_at: string;
}

export interface WebhookListResponse {
  webhooks: Webhook[];
  total: number;
}

export interface WebhookDeliveryListResponse {
  deliveries: WebhookDelivery[];
  total: number;
}

export interface WebhookCreateRequest {
  url: string;
  secret: string;
  events: string[];
  description?: string;
}

export interface WebhookUpdateRequest {
  url?: string;
  secret?: string;
  events?: string[];
  is_active?: boolean;
  description?: string;
}

export interface WebhookTestRequest {
  event_type: string;
}

export interface WebhookTestResponse {
  success: boolean;
  status_code: number | null;
  error_message: string | null;
  duration_ms: number | null;
  payload: string;
}

const webhooksApi = createApiClient<
  Webhook,
  WebhookListResponse,
  WebhookCreateRequest,
  WebhookUpdateRequest
>("/api/v1/partner-portal");

export const getWebhook = webhooksApi.get;
export const createWebhook = webhooksApi.create;
export const updateWebhook = webhooksApi.update;
export const deleteWebhook = webhooksApi.delete;

// Custom endpoints

export async function getWebhookEventTypes(): Promise<{ event_types: WebhookEventType[] }> {
  const response = await api.get<{ event_types: WebhookEventType[] }>(
    "/api/v1/partner-portal/event-types"
  );
  return response.data;
}

export async function getWebhooks(params?: {
  include_inactive?: boolean;
}): Promise<WebhookListResponse> {
  const response = await api.get<WebhookListResponse>("/api/v1/partner-portal", { params });
  return response.data;
}

export async function testWebhook(
  webhookId: string,
  data: WebhookTestRequest
): Promise<WebhookTestResponse> {
  const response = await api.post<WebhookTestResponse>(
    `/api/v1/partner-portal/${webhookId}/test`,
    data
  );
  return response.data;
}

export async function getWebhookDeliveries(
  webhookId: string,
  params?: { limit?: number; offset?: number }
): Promise<WebhookDeliveryListResponse> {
  const response = await api.get<WebhookDeliveryListResponse>(
    `/api/v1/partner-portal/${webhookId}/deliveries`,
    { params }
  );
  return response.data;
}

export async function getAllDeliveries(params?: {
  limit?: number;
  offset?: number;
}): Promise<WebhookDeliveryListResponse> {
  const response = await api.get<WebhookDeliveryListResponse>(
    "/api/v1/partner-portal/deliveries",
    { params }
  );
  return response.data;
}
