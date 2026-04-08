/**
 * Deletion request types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/deletion_request.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type DeletionRequest = components["schemas"]["DeletionRequestResponse"];
export type DeletionRequestListResponse = components["schemas"]["DeletionRequestListResponse"];
export type DeletionRequestCreate = components["schemas"]["DeletionRequestCreate"];

// ---------------------------------------------------------------------------
// Frontend-only types — query params
// ---------------------------------------------------------------------------

export interface RejectDeletionRequest {
  reason: string;
}

export interface DeletionRequestListParams {
  status?: string;
  entity_type?: string;
  skip?: number;
  limit?: number;
}
