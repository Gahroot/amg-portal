/**
 * Pulse survey types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/pulse_survey.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type PulseSurvey = components["schemas"]["PulseSurveyDetail"];
export type PulseSurveyListResponse = components["schemas"]["PulseSurveyListResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, request shapes, constants, analytics
// ---------------------------------------------------------------------------

export type PulseSurveyStatus = "draft" | "active" | "closed";
export type PulseSurveyResponseType = "emoji" | "stars" | "yes_no" | "thumbs";
export type PulseSurveyTrigger =
  | "document_delivery"
  | "milestone_completion"
  | "random";

export const PULSE_RESPONSE_VALUES: Record<PulseSurveyResponseType, string[]> =
  {
    emoji: ["happy", "neutral", "sad"],
    stars: ["1", "2", "3", "4", "5"],
    yes_no: ["yes", "no"],
    thumbs: ["up", "down"],
  };

export interface PulseSurveyCreateData {
  title: string;
  question: string;
  response_type: PulseSurveyResponseType;
  allow_comment?: boolean;
  trigger_type?: PulseSurveyTrigger;
  active_from?: string;
  active_to?: string;
  max_responses?: number;
  min_days_between_shows?: number;
}

export type PulseSurveyUpdateData = Partial<PulseSurveyCreateData> & {
  status?: PulseSurveyStatus;
};

export interface PulseSurveyResponse {
  id: string;
  survey_id: string;
  client_profile_id: string;
  response_value: string;
  comment: string | null;
  trigger_context: Record<string, unknown> | null;
  responded_at: string;
}

export interface PulseSurveyResponseListResponse {
  responses: PulseSurveyResponse[];
  total: number;
}

export interface PulseSurveyResponseCreateData {
  response_value: string;
  comment?: string;
  trigger_context?: Record<string, unknown>;
}

export interface PulseSurveyValueCount {
  value: string;
  count: number;
  percent: number;
}

export interface PulseSurveyStats {
  survey_id: string;
  survey_title: string;
  response_type: PulseSurveyResponseType;
  total_responses: number;
  breakdown: PulseSurveyValueCount[];
  has_comments: number;
  sentiment_score: number | null;
}

export interface PulseSurveyClientStatus {
  survey_id: string;
  has_responded: boolean;
  responded_at: string | null;
}

export interface PulseSurveyListParams {
  status?: PulseSurveyStatus;
  skip?: number;
  limit?: number;
}
