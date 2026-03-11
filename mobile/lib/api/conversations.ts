import api from '@/lib/api';
import type { Conversation, ConversationListResponse, Communication, CommunicationListResponse, SendMessageData } from '@/types/communication';

export async function listConversations(params?: { conversation_type?: string; skip?: number; limit?: number }): Promise<ConversationListResponse> {
  const res = await api.get<ConversationListResponse>('/conversations', { params });
  return res.data;
}

export async function getConversation(id: string): Promise<Conversation> {
  const res = await api.get<Conversation>(`/conversations/${id}`);
  return res.data;
}

export async function listMessages(conversationId: string, params?: { skip?: number; limit?: number }): Promise<CommunicationListResponse> {
  const res = await api.get<CommunicationListResponse>(`/conversations/${conversationId}/messages`, { params });
  return res.data;
}

export async function sendMessage(data: SendMessageData): Promise<Communication> {
  const res = await api.post<Communication>('/communications', data);
  return res.data;
}
