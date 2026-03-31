import api from "@/lib/api";

export interface CreateEnvelopeRequest {
  document_id: string;
  signer_email: string;
  signer_name: string;
  return_url: string;
}

export interface EnvelopeResponse {
  envelope_id: string;
  document_id: string;
  docusign_status: string;
}

export interface SigningUrlResponse {
  signing_url: string;
  envelope_id: string;
}

export async function createDocuSignEnvelope(
  data: CreateEnvelopeRequest,
): Promise<EnvelopeResponse> {
  const res = await api.post<EnvelopeResponse>("/api/v1/docusign/envelopes", data);
  return res.data;
}

export async function getDocuSignSigningUrl(params: {
  document_id: string;
  signer_email: string;
  signer_name: string;
  return_url: string;
}): Promise<SigningUrlResponse> {
  const res = await api.get<SigningUrlResponse>("/api/v1/docusign/signing-url", {
    params,
  });
  return res.data;
}
