
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
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  ConversationCreateData,
  ConversationUpdateData,
  SendMessageData,
} from "@/types/communication";

// Conversations
export function useConversations(params?: { skip?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.conversations.list(params),
    queryFn: () => listConversations(params),
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: queryKeys.conversations.detail(id),
    queryFn: () => getConversation(id),
    enabled: !!id,
  });
}

export function useCreateConversation() {
  return useCrudMutation({
    mutationFn: (data: ConversationCreateData) => createConversation(data),
    invalidateKeys: [queryKeys.conversations.all],
    errorMessage: "Failed to create conversation",
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ConversationUpdateData }) =>
      updateConversation(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update conversation"),
  });
}

// Messages
export function useMessages(conversationId: string, params?: { skip?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.conversations.messages(conversationId, params),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messagesAll(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to send message"),
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => markConversationRead(conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add participant"),
  });
}

// Unread count
export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.conversations.unreadCount(),
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
