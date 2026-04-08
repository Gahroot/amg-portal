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

// Conversations
export async function listConversations(
  params?: ConversationListParams
): Promise<ConversationListResponse> {
  const response = await api.get<ConversationListResponse>(
    "/api/v1/conversations/",
    { params }
  );
  return response.data;
}

export async function getConversation(id: string): Promise<Conversation> {
  const response = await api.get<Conversation>(`/api/v1/conversations/${id}`);
  return response.data;
}

export async function createConversation(
  data: ConversationCreateData
): Promise<Conversation> {
  const response = await api.post<Conversation>("/api/v1/conversations/", data);
  return response.data;
}

export async function updateConversation(
  id: string,
  data: ConversationUpdateData
): Promise<Conversation> {
  const response = await api.patch<Conversation>(`/api/v1/conversations/${id}`, data);
  return response.data;
}

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
  // Give the file a proper name with extension so the backend extracts the right ext
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
