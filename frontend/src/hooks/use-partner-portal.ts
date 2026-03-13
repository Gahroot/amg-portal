"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getMyProfile,
  getMyAssignments,
  getMyAssignment,
  getMyDeliverables,
  getMyDeliverable,
  getAssignmentDocuments,
  getDocumentDownloadUrl,
  getMyConversations,
  getMyConversation,
  getConversationMessages,
  sendMessageToConversation,
  markConversationAsRead,
  type AssignmentListParams,
  type DeliverableListParams,
} from "@/lib/api/partner-portal";
import { submitDeliverable } from "@/lib/api/deliverables";

// Profile
export function usePartnerProfile() {
  return useQuery({
    queryKey: ["partner-portal", "profile"],
    queryFn: getMyProfile,
  });
}

// Assignments
export function usePartnerAssignments(params?: AssignmentListParams) {
  return useQuery({
    queryKey: ["partner-portal", "assignments", params],
    queryFn: () => getMyAssignments(params),
  });
}

export function usePartnerAssignment(id: string) {
  return useQuery({
    queryKey: ["partner-portal", "assignments", id],
    queryFn: () => getMyAssignment(id),
    enabled: !!id,
  });
}

// Deliverables
export function usePartnerDeliverables(params?: DeliverableListParams) {
  return useQuery({
    queryKey: ["partner-portal", "deliverables", params],
    queryFn: () => getMyDeliverables(params),
  });
}

export function usePartnerDeliverable(id: string) {
  return useQuery({
    queryKey: ["partner-portal", "deliverables", id],
    queryFn: () => getMyDeliverable(id),
    enabled: !!id,
  });
}

export function useSubmitPartnerDeliverable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => submitDeliverable(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-portal", "deliverables"] });
      toast.success("Deliverable submitted successfully");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to submit deliverable"),
  });
}

// Documents
export function useAssignmentDocuments(assignmentId: string) {
  return useQuery({
    queryKey: ["partner-portal", "assignments", assignmentId, "documents"],
    queryFn: () => getAssignmentDocuments(assignmentId),
    enabled: !!assignmentId,
  });
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: (documentId: string) => getDocumentDownloadUrl(documentId),
    onSuccess: ({ download_url }) => {
      window.open(download_url, "_blank");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to get download link"),
  });
}

// Conversations
export function usePartnerConversations(params?: { limit?: number }) {
  return useQuery({
    queryKey: ["partner-portal", "conversations", params],
    queryFn: () => getMyConversations(params),
  });
}

export function usePartnerConversation(conversationId: string) {
  return useQuery({
    queryKey: ["partner-portal", "conversations", conversationId],
    queryFn: () => getMyConversation(conversationId),
    enabled: !!conversationId,
  });
}

export function usePartnerMessages(conversationId: string, params?: { skip?: number; limit?: number }) {
  return useQuery({
    queryKey: ["partner-portal", "conversations", conversationId, "messages", params],
    queryFn: () => getConversationMessages(conversationId, params),
    enabled: !!conversationId,
    refetchInterval: 5000,
  });
}

export function useSendPartnerMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) =>
      sendMessageToConversation(conversationId, body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["partner-portal", "conversations", variables.conversationId, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["partner-portal", "conversations"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to send message"),
  });
}

export function useMarkPartnerConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => markConversationAsRead(conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({
        queryKey: ["partner-portal", "conversations", conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ["partner-portal", "conversations"] });
    },
  });
}

// ============================================================================
// Class C Partner Reports
// ============================================================================

export function useActiveBriefSummary() {
  return useQuery({
    queryKey: ["partner-portal", "reports", "active-brief"],
    queryFn: () =>
      import("@/lib/api/partner-portal").then((m) =>
        m.getActiveBriefSummary(),
      ),
  });
}

export function useDeliverableFeedback(params?: { assignment_id?: string }) {
  return useQuery({
    queryKey: ["partner-portal", "reports", "deliverable-feedback", params],
    queryFn: () =>
      import("@/lib/api/partner-portal").then((m) =>
        m.getDeliverableFeedback(params),
      ),
  });
}

export function useExportDeliverableFeedback() {
  const exportFn = async (params?: { assignment_id?: string }) => {
    try {
      const mod = await import("@/lib/api/partner-portal");
      await mod.exportDeliverableFeedback(params);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to export feedback report";
      toast.error(message);
      throw error;
    }
  };
  return { exportFeedback: exportFn };
}

export function useEngagementHistory() {
  return useQuery({
    queryKey: ["partner-portal", "reports", "engagement-history"],
    queryFn: () =>
      import("@/lib/api/partner-portal").then((m) =>
        m.getEngagementHistory(),
      ),
  });
}

export function useExportEngagementHistory() {
  const exportFn = async () => {
    try {
      const mod = await import("@/lib/api/partner-portal");
      await mod.exportEngagementHistory();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to export engagement history";
      toast.error(message);
      throw error;
    }
  };
  return { exportHistory: exportFn };
}
