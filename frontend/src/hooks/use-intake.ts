
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  submitIntakeForm,
  getDraftIntake,
  saveIntakeStep,
  submitCompletedIntake,
} from "@/lib/api/intake";
import type { IntakeFormData } from "@/lib/validations/client";
import type { IntakeDraftData, IntakeFormResponse } from "@/types/intake-form";

export function useDraftIntake(profileId: string) {
  return useQuery({
    queryKey: ["intake", profileId],
    queryFn: () => getDraftIntake(profileId),
    enabled: !!profileId,
  });
}

export function useSaveIntakeStep(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ step, data }: { step: number; data: IntakeDraftData }) =>
      saveIntakeStep(profileId, step, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intake", profileId] });
      queryClient.invalidateQueries({ queryKey: ["clients", profileId] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to save"),
  });
}

export function useSubmitIntake() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: IntakeFormData) => submitIntakeForm(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client intake submitted successfully");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to submit intake"),
  });
}

export function useSubmitCompletedIntake(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => submitCompletedIntake(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["intake", profileId] });
      toast.success("Intake submitted for compliance review");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to submit intake"),
  });
}
