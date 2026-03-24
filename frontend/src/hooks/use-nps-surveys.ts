
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
    queryKey: ["nps-surveys", params],
    queryFn: () => listNPSSurveys(params),
  });
}

export function useActiveNPSSurvey() {
  return useQuery({
    queryKey: ["nps-surveys", "active"],
    queryFn: () => getActiveNPSSurvey(),
  });
}

export function useNPSSurvey(id: string) {
  return useQuery({
    queryKey: ["nps-surveys", id],
    queryFn: () => getNPSSurvey(id),
    enabled: !!id,
  });
}

export function useNPSSurveyStats(id: string) {
  return useQuery({
    queryKey: ["nps-surveys", id, "stats"],
    queryFn: () => getNPSSurveyStats(id),
    enabled: !!id,
  });
}

export function useNPSTrendAnalysis(params?: {
  client_profile_id?: string;
  quarters?: number;
}) {
  return useQuery({
    queryKey: ["nps-surveys", "trends", params],
    queryFn: () => getNPSTrendAnalysis(params),
  });
}

export function useNPSResponses(surveyId: string, params?: NPSResponseListParams) {
  return useQuery({
    queryKey: ["nps-surveys", surveyId, "responses", params],
    queryFn: () => listNPSResponses(surveyId, params),
    enabled: !!surveyId,
  });
}

export function useNPSResponse(surveyId: string, responseId: string) {
  return useQuery({
    queryKey: ["nps-surveys", surveyId, "responses", responseId],
    queryFn: () => getNPSResponse(surveyId, responseId),
    enabled: !!surveyId && !!responseId,
  });
}

export function useNPSFollowUps(surveyId: string, params?: NPSFollowUpListParams) {
  return useQuery({
    queryKey: ["nps-surveys", surveyId, "follow-ups", params],
    queryFn: () => listNPSFollowUps(surveyId, params),
    enabled: !!surveyId,
  });
}

export function useMyNPSFollowUps(params?: NPSFollowUpListParams) {
  return useQuery({
    queryKey: ["nps-surveys", "follow-ups", "my", params],
    queryFn: () => listMyNPSFollowUps(params),
  });
}

export function useNPSFollowUp(followUpId: string) {
  return useQuery({
    queryKey: ["nps-surveys", "follow-ups", followUpId],
    queryFn: () => getNPSFollowUp(followUpId),
    enabled: !!followUpId,
  });
}

export function useCreateNPSSurvey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: NPSSurveyCreateData) => createNPSSurvey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nps-surveys"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create NPS survey"),
  });
}

export function useUpdateNPSSurvey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: NPSSurveyUpdateData }) =>
      updateNPSSurvey(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["nps-surveys"] });
      queryClient.invalidateQueries({ queryKey: ["nps-surveys", variables.id] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update NPS survey"),
  });
}

export function useActivateNPSSurvey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => activateNPSSurvey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nps-surveys"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to activate NPS survey"),
  });
}

export function useCloseNPSSurvey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => closeNPSSurvey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nps-surveys"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to close NPS survey"),
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
        queryKey: ["nps-surveys", variables.surveyId, "responses"],
      });
      queryClient.invalidateQueries({
        queryKey: ["nps-surveys", variables.surveyId, "stats"],
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to submit NPS response"),
  });
}

export function useUpdateNPSFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      followUpId,
      data,
    }: {
      followUpId: string;
      data: NPSFollowUpUpdateData;
    }) => updateNPSFollowUp(followUpId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nps-surveys"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update NPS follow-up"),
  });
}

export function useAcknowledgeNPSFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (followUpId: string) => acknowledgeNPSFollowUp(followUpId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nps-surveys"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to acknowledge NPS follow-up"),
  });
}

export function useCompleteNPSFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      followUpId,
      resolutionNotes,
    }: {
      followUpId: string;
      resolutionNotes?: string;
    }) => completeNPSFollowUp(followUpId, resolutionNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nps-surveys"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to complete NPS follow-up"),
  });
}
