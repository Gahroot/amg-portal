import api from "@/lib/api";
import type {
  Conversation,
  ConversationListResponse,
  ConversationCreateData,
  ConversationUpdateData,
  Communication,
  CommunicationListResponse,
  SendMessageData,
} from "@/types/communication";
import { createApiClient } from "./factory";

export interface AudioUploadResult {
  object_path: string;
  url: string;
  file_size: number;
}

export interface ConversationListParams {
  skip?: number;
  limit?: number;
}

export interface MessageListParams {
  conversation_id: string;
  skip?: number;
  limit?: number;
}

const conversationsApi = createApiClient<
  Conversation,
  ConversationListResponse,
  ConversationCreateData,
  ConversationUpdateData
>("/api/v1/conversations/");

export const listConversations = conversationsApi.list as (
  params?: ConversationListParams,
) => Promise<ConversationListResponse>;
export const getConversation = conversationsApi.get;
export const createConversation = conversationsApi.create;
export const updateConversation = conversationsApi.update;

// Messages
export async function getMessages(
  params: MessageListParams
): Promise<CommunicationListResponse> {
  const response = await api.get<CommunicationListResponse>(
    `/api/v1/conversations/${params.conversation_id}/messages`,
    { params: { skip: params.skip, limit: params.limit } }
  );
  return response.data;
}

export async function sendMessage(
  conversationId: string,
  data: Omit<SendMessageData, "conversation_id">
): Promise<Communication> {
  const response = await api.post<Communication>(
    `/api/v1/conversations/${conversationId}/messages`,
    data
  );
  return response.data;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await api.post(`/api/v1/conversations/${conversationId}/mark-read`);
}

export async function addParticipant(
  conversationId: string,
  userId: string
): Promise<Conversation> {
  const response = await api.post<Conversation>(
    `/api/v1/conversations/${conversationId}/participants`,
    { user_id: userId }
  );
  return response.data;
}

// Voice messages
export async function uploadVoiceAudio(blob: Blob): Promise<AudioUploadResult> {
  const formData = new FormData();
  const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "mp4" : "webm";
  formData.append("file", blob, `voice_message.${ext}`);
  const response = await api.post<AudioUploadResult>(
    "/api/v1/communications/upload-audio",
    formData,
  );
  return response.data;
}

export async function getAudioPresignedUrl(objectPath: string): Promise<string> {
  const response = await api.get<{ url: string }>("/api/v1/communications/audio-url", {
    params: { object_path: objectPath },
  });
  return response.data.url;
}
