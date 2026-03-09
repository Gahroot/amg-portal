"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getClosureStatus,
  initiateClosure,
  updateChecklist,
  submitPartnerRating,
  getPartnerRatings,
  completeClosure,
} from "@/lib/api/closure";
import type { ChecklistItem, PartnerRatingCreate } from "@/lib/api/closure";

export function useClosureStatus(programId: string) {
  return useQuery({
    queryKey: ["closure", programId],
    queryFn: () => getClosureStatus(programId),
    enabled: !!programId,
    retry: false,
  });
}

export function usePartnerRatings(programId: string) {
  return useQuery({
    queryKey: ["closure", programId, "ratings"],
    queryFn: () => getPartnerRatings(programId),
    enabled: !!programId,
  });
}

export function useInitiateClosure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      programId,
      notes,
    }: {
      programId: string;
      notes?: string;
    }) =>
      initiateClosure(programId, {
        program_id: programId,
        notes,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["closure", variables.programId],
      });
      toast.success("Closure initiated successfully");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to initiate closure"),
  });
}

export function useUpdateChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      programId,
      items,
    }: {
      programId: string;
      items: ChecklistItem[];
    }) => updateChecklist(programId, items),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["closure", variables.programId],
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update checklist"),
  });
}

export function useSubmitPartnerRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      programId,
      data,
    }: {
      programId: string;
      data: PartnerRatingCreate;
    }) => submitPartnerRating(programId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["closure", variables.programId],
      });
      queryClient.invalidateQueries({
        queryKey: ["closure", variables.programId, "ratings"],
      });
      toast.success("Partner rating submitted");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to submit partner rating"),
  });
}

export function useCompleteClosure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (programId: string) => completeClosure(programId),
    onSuccess: (_, programId) => {
      queryClient.invalidateQueries({
        queryKey: ["closure", programId],
      });
      queryClient.invalidateQueries({
        queryKey: ["program", programId],
      });
      toast.success("Program closure completed");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to complete closure"),
  });
}
