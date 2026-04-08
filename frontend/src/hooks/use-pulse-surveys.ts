import { useQuery } from "@tanstack/react-query";
import {
  activatePulseSurvey,
  closePulseSurvey,
  createPulseSurvey,
  getActivePulseForMe,
  getMyPulseStatus,
  getPulseSurvey,
  getPulseSurveyStats,
  listPulseSurveyResponses,
  listPulseSurveys,
  submitPulseResponse,
  updatePulseSurvey,
} from "@/lib/api/pulse-surveys";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  PulseSurveyCreateData,
  PulseSurveyListParams,
  PulseSurveyResponseCreateData,
  PulseSurveyUpdateData,
} from "@/types/pulse-survey";

// ==================== Admin hooks ====================

export function usePulseSurveys(params?: PulseSurveyListParams) {
  return useQuery({
    queryKey: queryKeys.pulseSurveys.list(params),
    queryFn: () => listPulseSurveys(params),
  });
}

export function usePulseSurvey(id: string) {
  return useQuery({
    queryKey: queryKeys.pulseSurveys.detail(id),
    queryFn: () => getPulseSurvey(id),
    enabled: !!id,
  });
}

export function usePulseSurveyStats(id: string) {
  return useQuery({
    queryKey: queryKeys.pulseSurveys.stats(id),
    queryFn: () => getPulseSurveyStats(id),
    enabled: !!id,
  });
}

export function usePulseSurveyResponses(
  id: string,
  params?: { skip?: number; limit?: number }
) {
  return useQuery({
    queryKey: queryKeys.pulseSurveys.responses(id, params),
    queryFn: () => listPulseSurveyResponses(id, params),
    enabled: !!id,
  });
}

export function useCreatePulseSurvey() {
  return useCrudMutation({
    mutationFn: (data: PulseSurveyCreateData) => createPulseSurvey(data),
    invalidateKeys: [queryKeys.pulseSurveys.all],
    successMessage: "Pulse survey created",
    errorMessage: "Failed to create pulse survey",
  });
}

export function useUpdatePulseSurvey(id: string) {
  return useCrudMutation({
    mutationFn: (data: PulseSurveyUpdateData) => updatePulseSurvey(id, data),
    invalidateKeys: [queryKeys.pulseSurveys.all],
    successMessage: "Pulse survey updated",
    errorMessage: "Failed to update pulse survey",
  });
}

export function useActivatePulseSurvey() {
  return useCrudMutation({
    mutationFn: (id: string) => activatePulseSurvey(id),
    invalidateKeys: [queryKeys.pulseSurveys.all],
    successMessage: "Pulse survey activated",
    errorMessage: "Failed to activate pulse survey",
  });
}

export function useClosePulseSurvey() {
  return useCrudMutation({
    mutationFn: (id: string) => closePulseSurvey(id),
    invalidateKeys: [queryKeys.pulseSurveys.all],
    successMessage: "Pulse survey closed",
    errorMessage: "Failed to close pulse survey",
  });
}

// ==================== Client hooks ====================

/**
 * Returns an active pulse survey the current client hasn't answered yet,
 * or null if there's nothing pending. Polls infrequently (every 5 minutes).
 */
export function useActivePulseForMe() {
  return useQuery({
    queryKey: queryKeys.pulseSurveys.activeForMe(),
    queryFn: () => getActivePulseForMe(),
    // Poll every 5 minutes; the endpoint already enforces anti-fatigue logic
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });
}

export function useMyPulseStatus(surveyId: string) {
  return useQuery({
    queryKey: queryKeys.pulseSurveys.myStatus(surveyId),
    queryFn: () => getMyPulseStatus(surveyId),
    enabled: !!surveyId,
  });
}

export function useSubmitPulseResponse() {
  return useCrudMutation({
    mutationFn: ({
      surveyId,
      data,
    }: {
      surveyId: string;
      data: PulseSurveyResponseCreateData;
    }) => submitPulseResponse(surveyId, data),
    invalidateKeys: [queryKeys.pulseSurveys.all],
    errorMessage: "Failed to submit feedback",
  });
}
