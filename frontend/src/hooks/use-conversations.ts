
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  getMessages,
  sendMessage,
  markConversationRead,
  addParticipant,
} from "@/lib/api/conversations";
import type {
  Conversation,
  ConversationCreateData,
  ConversationUpdateData,
  Communication,
  SendMessageData,
} from "@/types/communication";

// Conversations
export function useConversations(params?: { skip?: number; limit?: number }) {
  return useQuery({
    queryKey: ["conversations", params],
    queryFn: () => listConversations(params),
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ["conversation", id],
    queryFn: () => getConversation(id),
    enabled: !!id,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ConversationCreateData) => createConversation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create conversation"),
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ConversationUpdateData }) =>
      updateConversation(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["conversation", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update conversation"),
  });
}

// Messages
export function useMessages(conversationId: string, params?: { skip?: number; limit?: number }) {
  return useQuery({
    queryKey: ["messages", conversationId, params],
    queryFn: () => getMessages({ conversation_id: conversationId, ...params }),
    enabled: !!conversationId,
    refetchInterval: 5000, // Poll for new messages every 5 seconds
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, data }: { conversationId: string; data: SendMessageData }) =>
      sendMessage(conversationId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["messages", variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to send message"),
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => markConversationRead(conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to mark conversation as read"),
  });
}

export function useAddParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string }) =>
      addParticipant(conversationId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["conversation", variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add participant"),
  });
}

// Unread count
export function useUnreadCount() {
  return useQuery({
    queryKey: ["unread-count"],
    queryFn: async () => {
      const response = await fetch("/api/v1/communications/unread-count", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch unread count");
      }
      return response.json();
    },
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 10000, // Consider data fresh for 10 seconds
  });
}

// Unread message count for navigation badges
export function useUnreadMessageCount() {
  const { data } = useConversations({ limit: 100 });
  
  // Calculate total unread from conversations
  const totalUnread = data?.conversations.reduce(
    (sum, conv) => sum + (conv.unread_count || 0),
    0
  ) ?? 0;
  
  return totalUnread;
}
