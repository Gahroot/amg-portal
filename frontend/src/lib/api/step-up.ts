import api from "@/lib/api";

export interface StepUpTokenResponse {
  step_up_token: string;
  expires_in: number;
  action_scope: string[];
}

export interface MintStepUpTokenRequest {
  action_scope: string[];
  password?: string;
  totp_code?: string;
}

export async function mintStepUpToken(
  data: MintStepUpTokenRequest
): Promise<StepUpTokenResponse> {
  // Avoid the interceptor re-entering step-up if this call itself 401s.
  const response = await api.post<StepUpTokenResponse>(
    "/api/v1/auth/step-up",
    data,
    { _skipStepUp: true } as never
  );
  return response.data;
}
