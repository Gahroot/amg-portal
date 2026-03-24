import api from "@/lib/api";
import type {
  MessageDigestPreference,
  MessageDigestPreferenceUpdate,
  DigestPreviewResponse,
} from "@/types/communication";

export async function getDigestPreferences(): Promise<MessageDigestPreference> {
  const response = await api.get<MessageDigestPreference>(
    "/api/v1/messaging/digest-preferences"
  );
  return response.data;
}

export async function updateDigestPreferences(
  data: MessageDigestPreferenceUpdate
): Promise<MessageDigestPreference> {
  const response = await api.put<MessageDigestPreference>(
    "/api/v1/messaging/digest-preferences",
    data
  );
  return response.data;
}

export async function previewDigest(): Promise<DigestPreviewResponse> {
  const response = await api.post<DigestPreviewResponse>(
    "/api/v1/messaging/digest/preview"
  );
  return response.data;
}
