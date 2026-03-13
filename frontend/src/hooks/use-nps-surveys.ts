"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listNPSSurveys,
  getNPSSurvey,
  getActiveNPSSurvey,
  createNPSSurvey,
  updateNPSSurvey,
  activateNPSSurvey,
  closeNPSSurvey,
  getNPSSurveyStats,
  getNPSTrendAnalysis,
  listNPSResponses,
  submitNPSResponse,
  listNPSFollowUps,
  updateNPSFollowUp,
  completeNPSFollowUp,
} from "@/lib/api/nps-surveys";
import type {
  NPSSurveyCreateData,
  NPSSurveyUpdateData,
  NPSSurveyListParams,
  NPSResponseCreateData,
  NPSResponseListParams,
  NPSFollowUpListParams,
  NPSFollowUpUpdateData,
} from "@/types/nps-survey";

export function useNPSSurveys(params?: NPSSurveyListParams) {
  return useQuery({
    queryKey: ["nps-surveys", params],
    queryFn: () => listNPSSurveys(params),
  });
}

export function useNPSSurvey(id: string) {
  return useQuery({
    queryKey: ["nps-surveys", id],
    queryFn: () => getNPSSurvey(id),
    enabled: !!id,
  });
}

export function useActiveNPSSurvey() {
  return useQuery({
    queryKey: ["nps-surveys", "active"],
    queryFn: () => getActiveNPSSurvey(),
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
      toast.error(error.message || "Failed to create survey"),
  });
}

export function useUpdateNPSSurvey(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: NPSSurveyUpdateData) => updateNPSSurvey(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nps-surveys"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update survey"),
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
      toast.error(error.message || "Failed to activate survey"),
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
      toast.error(error.message || "Failed to close survey"),
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

export function useNPSResponses(
  surveyId: string,
  params?: NPSResponseListParams
) {
  return useQuery({
    queryKey: ["nps-surveys", surveyId, "responses", params],
    queryFn: () => listNPSResponses(surveyId, params),
    enabled: !!surveyId,
  });
}

export function useSubmitNPSResponse(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: NPSResponseCreateData) =>
      submitNPSResponse(surveyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["nps-surveys", surveyId, "responses"],
      });
      queryClient.invalidateQueries({
        queryKey: ["nps-surveys", surveyId, "stats"],
      });
      queryClient.invalidateQueries({ queryKey: ["nps-surveys", "active"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to submit response"),
  });
}

export function useNPSFollowUps(
  surveyId: string,
  params?: NPSFollowUpListParams
) {
  return useQuery({
    queryKey: ["nps-surveys", surveyId, "follow-ups", params],
    queryFn: () => listNPSFollowUps(surveyId, params),
    enabled: !!surveyId,
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
      toast.error(error.message || "Failed to update follow-up"),
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
      toast.error(error.message || "Failed to complete follow-up"),
  });
}
