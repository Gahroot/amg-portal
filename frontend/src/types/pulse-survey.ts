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
export type PulseSurveyCreateData = components["schemas"]["PulseSurveyCreate"];
export type PulseSurveyUpdateData = components["schemas"]["PulseSurveyUpdate"];
export type PulseSurveyStatus = components["schemas"]["PulseSurveyStatus"];
export type PulseSurveyResponseType = components["schemas"]["PulseSurveyResponseType"];
export type PulseSurveyTrigger = components["schemas"]["PulseSurveyTrigger"];

export type PulseSurveyResponse = components["schemas"]["PulseSurveyResponseDetail"];
export type PulseSurveyResponseListResponse = components["schemas"]["PulseSurveyResponseListResponse"];
export type PulseSurveyResponseCreateData = components["schemas"]["PulseSurveyResponseCreate"];

export type PulseSurveyStats = components["schemas"]["PulseSurveyStats"];
export type PulseSurveyValueCount = components["schemas"]["PulseSurveyValueCount"];
export type PulseSurveyClientStatus = components["schemas"]["PulseSurveyClientStatus"];

// ---------------------------------------------------------------------------
// Frontend-only types — UI constants
// ---------------------------------------------------------------------------

export const PULSE_RESPONSE_VALUES: Record<PulseSurveyResponseType, string[]> =
  {
    emoji: ["happy", "neutral", "sad"],
    stars: ["1", "2", "3", "4", "5"],
    yes_no: ["yes", "no"],
    thumbs: ["up", "down"],
  };

export interface PulseSurveyListParams {
  status?: PulseSurveyStatus;
  skip?: number;
  limit?: number;
}
