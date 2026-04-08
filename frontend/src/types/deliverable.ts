/**
 * Deliverable types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/deliverable.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type DeliverableItem = components["schemas"]["DeliverableResponse"];
export type DeliverableListResponse = components["schemas"]["DeliverableListResponse"];
export type DeliverableCreateData = components["schemas"]["DeliverableCreate"];
export type DeliverableUpdateData = components["schemas"]["DeliverableUpdate"];
export type DeliverableReviewData = components["schemas"]["DeliverableReview"];

// ---------------------------------------------------------------------------
// Frontend-only types — query params
// ---------------------------------------------------------------------------

export interface DeliverableListParams {
  skip?: number;
  limit?: number;
  assignment_id?: string;
  status?: string;
  search?: string;
}
