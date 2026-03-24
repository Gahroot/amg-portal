import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import type {
  PulseSurveyCreateData,
  PulseSurveyListParams,
  PulseSurveyResponseCreateData,
  PulseSurveyUpdateData,
} from "@/types/pulse-survey";

// ==================== Admin hooks ====================

export function usePulseSurveys(params?: PulseSurveyListParams) {
  return useQuery({
    queryKey: ["pulse-surveys", params],
    queryFn: () => listPulseSurveys(params),
  });
}

export function usePulseSurvey(id: string) {
  return useQuery({
    queryKey: ["pulse-surveys", id],
    queryFn: () => getPulseSurvey(id),
    enabled: !!id,
  });
}

export function usePulseSurveyStats(id: string) {
  return useQuery({
    queryKey: ["pulse-surveys", id, "stats"],
    queryFn: () => getPulseSurveyStats(id),
    enabled: !!id,
  });
}

export function usePulseSurveyResponses(
  id: string,
  params?: { skip?: number; limit?: number }
) {
  return useQuery({
    queryKey: ["pulse-surveys", id, "responses", params],
    queryFn: () => listPulseSurveyResponses(id, params),
    enabled: !!id,
  });
}

export function useCreatePulseSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PulseSurveyCreateData) => createPulseSurvey(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pulse-surveys"] });
      toast.success("Pulse survey created");
    },
    onError: () => {
      toast.error("Failed to create pulse survey");
    },
  });
}

export function useUpdatePulseSurvey(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PulseSurveyUpdateData) => updatePulseSurvey(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pulse-surveys"] });
      toast.success("Pulse survey updated");
    },
    onError: () => {
      toast.error("Failed to update pulse survey");
    },
  });
}

export function useActivatePulseSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => activatePulseSurvey(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pulse-surveys"] });
      toast.success("Pulse survey activated");
    },
    onError: () => {
      toast.error("Failed to activate pulse survey");
    },
  });
}

export function useClosePulseSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => closePulseSurvey(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pulse-surveys"] });
      toast.success("Pulse survey closed");
    },
    onError: () => {
      toast.error("Failed to close pulse survey");
    },
  });
}

// ==================== Client hooks ====================

/**
 * Returns an active pulse survey the current client hasn't answered yet,
 * or null if there's nothing pending. Polls infrequently (every 5 minutes).
 */
export function useActivePulseForMe() {
  return useQuery({
    queryKey: ["pulse-surveys", "active-for-me"],
    queryFn: () => getActivePulseForMe(),
    // Poll every 5 minutes; the endpoint already enforces anti-fatigue logic
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });
}

export function useMyPulseStatus(surveyId: string) {
  return useQuery({
    queryKey: ["pulse-surveys", surveyId, "my-status"],
    queryFn: () => getMyPulseStatus(surveyId),
    enabled: !!surveyId,
  });
}

export function useSubmitPulseResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      surveyId,
      data,
    }: {
      surveyId: string;
      data: PulseSurveyResponseCreateData;
    }) => submitPulseResponse(surveyId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pulse-surveys", "active-for-me"] });
      qc.invalidateQueries({ queryKey: ["pulse-surveys"] });
    },
    onError: () => {
      toast.error("Failed to submit feedback");
    },
  });
}
