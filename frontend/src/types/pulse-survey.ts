// Pulse Survey Types

export type PulseSurveyStatus = "draft" | "active" | "closed";
export type PulseSurveyResponseType = "emoji" | "stars" | "yes_no" | "thumbs";
export type PulseSurveyTrigger =
  | "document_delivery"
  | "milestone_completion"
  | "random";

// Valid response values per type
export const PULSE_RESPONSE_VALUES: Record<PulseSurveyResponseType, string[]> =
  {
    emoji: ["happy", "neutral", "sad"],
    stars: ["1", "2", "3", "4", "5"],
    yes_no: ["yes", "no"],
    thumbs: ["up", "down"],
  };

// ==================== Survey Types ====================

export interface PulseSurvey {
  id: string;
  title: string;
  question: string;
  response_type: PulseSurveyResponseType;
  allow_comment: boolean;
  status: PulseSurveyStatus;
  trigger_type: PulseSurveyTrigger;
  active_from: string | null;
  active_to: string | null;
  max_responses: number | null;
  min_days_between_shows: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  response_count: number;
}

export interface PulseSurveyListResponse {
  surveys: PulseSurvey[];
  total: number;
}

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

// ==================== Response Types ====================

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

// ==================== Analytics Types ====================

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

// ==================== Query Params ====================

export interface PulseSurveyListParams {
  status?: PulseSurveyStatus;
  skip?: number;
  limit?: number;
}
