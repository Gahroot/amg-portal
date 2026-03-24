import api from "@/lib/api";
import type { IntakeFormData } from "@/lib/validations/client";
import type { IntakeDraftData, IntakeFormResponse } from "@/types/intake-form";

export async function submitIntakeForm(
  data: IntakeFormData
): Promise<IntakeFormResponse> {
  const response = await api.post<IntakeFormResponse>("/api/v1/intake", data);
  return response.data;
}

export async function getDraftIntake(
  profileId: string
): Promise<IntakeFormResponse> {
  const response = await api.get<IntakeFormResponse>(
    `/api/v1/intake/${profileId}/draft`
  );
  return response.data;
}

export async function saveIntakeStep(
  profileId: string,
  step: number,
  data: IntakeDraftData
): Promise<IntakeFormResponse> {
  const response = await api.patch<IntakeFormResponse>(
    `/api/v1/intake/${profileId}/step/${step}`,
    data
  );
  return response.data;
}

export async function submitCompletedIntake(
  profileId: string
): Promise<IntakeFormResponse> {
  const response = await api.post<IntakeFormResponse>(
    `/api/v1/intake/${profileId}/submit`
  );
  return response.data;
}
