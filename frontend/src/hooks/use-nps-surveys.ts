
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listNPSSurveys,
  getActiveNPSSurvey,
  getNPSSurvey,
  createNPSSurvey,
  updateNPSSurvey,
  activateNPSSurvey,
  closeNPSSurvey,
  getNPSSurveyStats,
  getNPSTrendAnalysis,
  listNPSResponses,
  submitNPSResponse,
  getNPSResponse,
  listNPSFollowUps,
  listMyNPSFollowUps,
  getNPSFollowUp,
  updateNPSFollowUp,
  acknowledgeNPSFollowUp,
  completeNPSFollowUp,
} from "@/lib/api/nps-surveys";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  NPSSurveyListParams,
  NPSResponseListParams,
  NPSFollowUpListParams,
  NPSSurveyCreateData,
  NPSSurveyUpdateData,
  NPSResponseCreateData,
  NPSFollowUpUpdateData,
} from "@/types/nps-survey";

export function useNPSSurveys(params?: NPSSurveyListParams) {
  return useQuery({
    queryKey: queryKeys.npsSurveys.list(params),
    queryFn: () => listNPSSurveys(params),
  });
}

export function useActiveNPSSurvey() {
  return useQuery({
    queryKey: queryKeys.npsSurveys.active(),
    queryFn: () => getActiveNPSSurvey(),
  });
}

export function useNPSSurvey(id: string) {
  return useQuery({
    queryKey: queryKeys.npsSurveys.detail(id),
    queryFn: () => getNPSSurvey(id),
    enabled: !!id,
  });
}

export function useNPSSurveyStats(id: string) {
  return useQuery({
    queryKey: queryKeys.npsSurveys.stats(id),
    queryFn: () => getNPSSurveyStats(id),
    enabled: !!id,
  });
}

export function useNPSTrendAnalysis(params?: {
  client_profile_id?: string;
  quarters?: number;
}) {
  return useQuery({
    queryKey: queryKeys.npsSurveys.trends(params),
    queryFn: () => getNPSTrendAnalysis(params),
  });
}

export function useNPSResponses(surveyId: string, params?: NPSResponseListParams) {
  return useQuery({
    queryKey: queryKeys.npsSurveys.responses(surveyId, params),
    queryFn: () => listNPSResponses(surveyId, params),
    enabled: !!surveyId,
  });
}

export function useNPSResponse(surveyId: string, responseId: string) {
  return useQuery({
    queryKey: queryKeys.npsSurveys.response(surveyId, responseId),
    queryFn: () => getNPSResponse(surveyId, responseId),
    enabled: !!surveyId && !!responseId,
  });
}

export function useNPSFollowUps(surveyId: string, params?: NPSFollowUpListParams) {
  return useQuery({
    queryKey: queryKeys.npsSurveys.followUps.bySurvey(surveyId, params),
    queryFn: () => listNPSFollowUps(surveyId, params),
    enabled: !!surveyId,
  });
}

export function useMyNPSFollowUps(params?: NPSFollowUpListParams) {
  return useQuery({
    queryKey: queryKeys.npsSurveys.followUps.my(params),
    queryFn: () => listMyNPSFollowUps(params),
  });
}

export function useNPSFollowUp(followUpId: string) {
  return useQuery({
    queryKey: queryKeys.npsSurveys.followUps.detail(followUpId),
    queryFn: () => getNPSFollowUp(followUpId),
    enabled: !!followUpId,
  });
}

export function useCreateNPSSurvey() {
  return useCrudMutation({
    mutationFn: (data: NPSSurveyCreateData) => createNPSSurvey(data),
    invalidateKeys: [queryKeys.npsSurveys.all],
    errorMessage: "Failed to create NPS survey",
  });
}

export function useUpdateNPSSurvey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: NPSSurveyUpdateData }) =>
      updateNPSSurvey(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.npsSurveys.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.npsSurveys.detail(variables.id) });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update NPS survey"),
  });
}

export function useActivateNPSSurvey() {
  return useCrudMutation({
    mutationFn: (id: string) => activateNPSSurvey(id),
    invalidateKeys: [queryKeys.npsSurveys.all],
    errorMessage: "Failed to activate NPS survey",
  });
}

export function useCloseNPSSurvey() {
  return useCrudMutation({
    mutationFn: (id: string) => closeNPSSurvey(id),
    invalidateKeys: [queryKeys.npsSurveys.all],
    errorMessage: "Failed to close NPS survey",
  });
}

export function useSubmitNPSResponse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      surveyId,
      data,
    }: {
      surveyId: string;
      data: NPSResponseCreateData;
    }) => submitNPSResponse(surveyId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.npsSurveys.responsesAll(variables.surveyId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.npsSurveys.stats(variables.surveyId),
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to submit NPS response"),
  });
}

export function useUpdateNPSFollowUp() {
  return useCrudMutation({
    mutationFn: ({
      followUpId,
      data,
    }: {
      followUpId: string;
      data: NPSFollowUpUpdateData;
    }) => updateNPSFollowUp(followUpId, data),
    invalidateKeys: [queryKeys.npsSurveys.all],
    errorMessage: "Failed to update NPS follow-up",
  });
}

export function useAcknowledgeNPSFollowUp() {
  return useCrudMutation({
    mutationFn: (followUpId: string) => acknowledgeNPSFollowUp(followUpId),
    invalidateKeys: [queryKeys.npsSurveys.all],
    errorMessage: "Failed to acknowledge NPS follow-up",
  });
}

export function useCompleteNPSFollowUp() {
  return useCrudMutation({
    mutationFn: ({
      followUpId,
      resolutionNotes,
    }: {
      followUpId: string;
      resolutionNotes?: string;
    }) => completeNPSFollowUp(followUpId, resolutionNotes),
    invalidateKeys: [queryKeys.npsSurveys.all],
    errorMessage: "Failed to complete NPS follow-up",
  });
}
