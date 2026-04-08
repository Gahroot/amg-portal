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
export type NPSTrendAnalysis = components["schemas"]["NPSTrendAnalysis"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, request shapes, query params, analytics
// ---------------------------------------------------------------------------

export type NPSSurveyStatus = "draft" | "scheduled" | "active" | "closed" | "archived";
export type NPSScoreCategory = "detractor" | "passive" | "promoter";
export type NPSFollowUpStatus = "pending" | "acknowledged" | "in_progress" | "completed" | "cancelled";
export type NPSFollowUpPriority = "low" | "medium" | "high" | "urgent";
export type NPSFollowUpActionType =
  | "personal_reach_out"
  | "escalation"
  | "service_review"
  | "management_intervention"
  | "process_improvement";

export interface NPSSurveyCreateData {
  name: string;
  description?: string;
  quarter: number;
  year: number;
  questions?: Record<string, unknown>;
  distribution_method?: string;
  reminder_enabled?: boolean;
  reminder_days?: number;
  scheduled_at?: string;
  closes_at?: string;
  target_client_types?: string[];
  target_client_ids?: string[];
}

export type NPSSurveyUpdateData = Partial<NPSSurveyCreateData> & {
  status?: NPSSurveyStatus;
};

export interface NPSResponse {
  id: string;
  survey_id: string;
  client_profile_id: string;
  score: number;
  score_category: NPSScoreCategory;
  comment: string | null;
  custom_responses: Record<string, unknown> | null;
  responded_at: string;
  response_channel: string;
  follow_up_required: boolean;
  follow_up_completed: boolean;
}

export interface NPSResponseListResponse {
  responses: NPSResponse[];
  total: number;
}

export interface NPSResponseCreateData {
  survey_id: string;
  score: number;
  comment?: string;
  custom_responses?: Record<string, unknown>;
  response_channel?: string;
}

export interface NPSFollowUp {
  id: string;
  survey_id: string;
  response_id: string;
  client_profile_id: string;
  assigned_to: string;
  priority: NPSFollowUpPriority;
  status: NPSFollowUpStatus;
  action_type: NPSFollowUpActionType;
  notes: string | null;
  resolution_notes: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NPSFollowUpListResponse {
  follow_ups: NPSFollowUp[];
  total: number;
}

export interface NPSFollowUpUpdateData {
  assigned_to?: string;
  priority?: NPSFollowUpPriority;
  status?: NPSFollowUpStatus;
  action_type?: NPSFollowUpActionType;
  notes?: string;
  resolution_notes?: string;
  due_at?: string;
}

export interface NPSSurveyStats {
  survey_id: string;
  survey_name: string;
  quarter: number;
  year: number;
  total_sent: number;
  total_responses: number;
  response_rate: number;
  nps_score: number;
  promoters_count: number;
  passives_count: number;
  detractors_count: number;
  promoters_percent: number;
  passives_percent: number;
  detractors_percent: number;
  average_score: number;
  follow_ups_pending: number;
  follow_ups_completed: number;
}

export interface NPSTrendPoint {
  period: string;
  quarter: number;
  year: number;
  nps_score: number;
  response_count: number;
  promoters_percent: number;
  passives_percent: number;
  detractors_percent: number;
}

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
