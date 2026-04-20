import {
  startAuthentication,
  startRegistration,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/browser";

import api from "@/lib/api";

export interface PasskeySummary {
  id: string;
  nickname: string | null;
  aaguid: string | null;
  transports: string[];
  last_used_at: string | null;
  created_at: string;
}

export interface RegisterResult {
  id: string;
  nickname: string | null;
  aaguid: string | null;
}

export function isWebAuthnSupported(): boolean {
  return typeof window !== "undefined" && browserSupportsWebAuthn();
}

export async function listPasskeys(): Promise<PasskeySummary[]> {
  const response = await api.get<PasskeySummary[]>(
    "/api/v1/webauthn/credentials"
  );
  return response.data;
}

export async function deletePasskey(credentialId: string): Promise<void> {
  await api.delete(`/api/v1/webauthn/credentials/${credentialId}`);
}

export async function registerPasskey(
  nickname: string | null
): Promise<RegisterResult> {
  if (!isWebAuthnSupported()) {
    throw new Error("Passkeys are not supported in this browser");
  }
  const beginResp = await api.post<PublicKeyCredentialCreationOptionsJSON>(
    "/api/v1/webauthn/register/begin",
    { nickname }
  );

  const attestation: RegistrationResponseJSON = await startRegistration({
    optionsJSON: beginResp.data,
  });

  const completeResp = await api.post<RegisterResult>(
    "/api/v1/webauthn/register/complete",
    { credential: attestation }
  );
  return completeResp.data;
}

export async function authenticateWithPasskey(
  email: string
): Promise<{ access_token: string; refresh_token: string }> {
  if (!isWebAuthnSupported()) {
    throw new Error("Passkeys are not supported in this browser");
  }
  const beginResp = await api.post<PublicKeyCredentialRequestOptionsJSON>(
    "/api/v1/webauthn/authenticate/begin",
    { email }
  );

  const assertion: AuthenticationResponseJSON = await startAuthentication({
    optionsJSON: beginResp.data,
  });

  const completeResp = await api.post<{
    access_token: string;
    refresh_token: string;
  }>("/api/v1/webauthn/authenticate/complete", {
    email,
    credential: assertion,
  });
  return completeResp.data;
}
