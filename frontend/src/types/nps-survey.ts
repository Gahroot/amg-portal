/**
 * NPS survey types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/nps_survey.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type NPSSurvey = components["schemas"]["NPSSurveyResponse"];
export type NPSSurveyListResponse = components["schemas"]["NPSSurveyListResponse"];
export type NPSSurveyCreateData = components["schemas"]["NPSSurveyCreate"];
export type NPSSurveyUpdateData = components["schemas"]["NPSSurveyUpdate"];
export type NPSSurveyStatus = components["schemas"]["NPSSurveyStatus"];
export type NPSSurveyStats = components["schemas"]["NPSSurveyStats"];
export type NPSTrendAnalysis = components["schemas"]["NPSTrendAnalysis"];
export type NPSTrendPoint = components["schemas"]["NPSTrendPoint"];

export type NPSResponse = components["schemas"]["NPSResponseDetail"];
export type NPSResponseListResponse = components["schemas"]["NPSResponseListResponse"];
export type NPSResponseCreateData = components["schemas"]["NPSResponseCreate"];

export type NPSFollowUp = components["schemas"]["NPSFollowUpResponse"];
export type NPSFollowUpListResponse = components["schemas"]["NPSFollowUpListResponse"];
export type NPSFollowUpUpdateData = components["schemas"]["NPSFollowUpUpdate"];
export type NPSFollowUpStatus = components["schemas"]["NPSFollowUpStatus"];
export type NPSFollowUpPriority = components["schemas"]["NPSFollowUpPriority"];
export type NPSFollowUpActionType = components["schemas"]["NPSFollowUpActionType"];

// ---------------------------------------------------------------------------
// Frontend-only types — query params, computed display categories
// ---------------------------------------------------------------------------

export type NPSScoreCategory = "detractor" | "passive" | "promoter";

export interface NPSSurveyListParams {
  status?: NPSSurveyStatus;
  year?: number;
  quarter?: number;
  skip?: number;
  limit?: number;
}

export interface NPSResponseListParams {
  score_category?: NPSScoreCategory;
  skip?: number;
  limit?: number;
}

export interface NPSFollowUpListParams {
  status?: NPSFollowUpStatus;
  priority?: NPSFollowUpPriority;
  skip?: number;
  limit?: number;
}
