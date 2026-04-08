
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  submitIntakeForm,
  getDraftIntake,
  saveIntakeStep,
  submitCompletedIntake,
} from "@/lib/api/intake";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type { IntakeFormData } from "@/lib/validations/client";
import type { IntakeDraftData } from "@/types/intake-form";

export function useDraftIntake(profileId: string) {
  return useQuery({
    queryKey: queryKeys.intake.draft(profileId),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.intake.draft(profileId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.profile(profileId) });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to save"),
  });
}

export function useSubmitIntake() {
  return useCrudMutation({
    mutationFn: (data: IntakeFormData) => submitIntakeForm(data),
    invalidateKeys: [queryKeys.clients.all],
    successMessage: "Client intake submitted successfully",
    errorMessage: "Failed to submit intake",
  });
}

export function useSubmitCompletedIntake(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => submitCompletedIntake(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.intake.draft(profileId) });
      toast.success("Intake submitted for compliance review");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to submit intake"),
  });
}
