/**
 * Capability review types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/capability_review.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type CapabilityReview = components["schemas"]["CapabilityReviewResponse"];
export type CapabilityReviewListResponse = components["schemas"]["CapabilityReviewListResponse"];
export type CapabilityReviewStatistics = components["schemas"]["CapabilityReviewStatistics"];

// ---------------------------------------------------------------------------
// Frontend-only types — request shapes, query params
// ---------------------------------------------------------------------------

export interface CapabilityReviewFinding {
  finding_type: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  recommendation: string | null;
}

export interface CreateCapabilityReviewRequest {
  partner_id: string;
  review_year: number;
  reviewer_id?: string;
  scheduled_date?: string;
  notes?: string;
}

export interface UpdateCapabilityReviewRequest {
  status?: string;
  reviewer_id?: string;
  scheduled_date?: string;
  capabilities_reviewed?: string[];
  certifications_reviewed?: string[];
  qualifications_reviewed?: string[];
  findings?: CapabilityReviewFinding[];
  notes?: string;
  recommendations?: string;
}

export interface CompleteCapabilityReviewRequest {
  findings?: CapabilityReviewFinding[];
  recommendations?: string;
  notes?: string;
}

export interface GenerateAnnualReviewsRequest {
  review_year: number;
  scheduled_date?: string;
}

export interface CapabilityReviewListParams {
  skip?: number;
  limit?: number;
  status?: string;
  partner_id?: string;
  year?: number;
}
