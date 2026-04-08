
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
  getPartnerBriefSummary,
  getPartnerDeliverableFeedback,
  getPartnerEngagementHistory,
  getMyPerformanceNotices,
  acknowledgePerformanceNotice,
  getCapabilityRefreshStatus,
  submitCapabilityRefresh,
  getMyScorecard,
  getMyPerformanceStatus,
  getMyPayments,
  getMyPaymentSummary,
  type AssignmentListParams,
  type DeliverableListParams,
  type ScorecardPeriod,
  type PaymentListParams,
} from "@/lib/api/partner-portal";
import type { CapabilityRefreshRequest } from "@/types/partner";
import { submitDeliverable } from "@/lib/api/deliverables";
import { getPartnerOnboarding } from "@/lib/api/partner-capabilities";

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

function usePartnerMessageMutation<T extends { conversationId: string }>(
  extractBody: (vars: T) => string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: T) => sendMessageToConversation(vars.conversationId, extractBody(vars)),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["partner-portal", "conversations", variables.conversationId, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["partner-portal", "conversations"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to send message"),
  });
}

export function useSendPartnerMessage() {
  return usePartnerMessageMutation<{ conversationId: string; body: string }>(
    (vars) => vars.body,
  );
}

export function useSendPartnerMessageForView() {
  return usePartnerMessageMutation<{ conversationId: string; data: { body: string; attachment_ids?: string[] } }>(
    (vars) => vars.data.body,
  );
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

// Partner Reports (Class C)
export function usePartnerBriefSummary() {
  return useQuery({
    queryKey: ["partner-portal", "reports", "brief-summary"],
    queryFn: getPartnerBriefSummary,
  });
}

export function usePartnerDeliverableFeedback(assignmentId?: string) {
  return useQuery({
    queryKey: ["partner-portal", "reports", "deliverable-feedback", assignmentId],
    queryFn: () => getPartnerDeliverableFeedback(assignmentId),
  });
}

export function usePartnerEngagementHistory() {
  return useQuery({
    queryKey: ["partner-portal", "reports", "engagement-history"],
    queryFn: getPartnerEngagementHistory,
  });
}

// Performance Notices
export function useMyPerformanceNotices() {
  return useQuery({
    queryKey: ["partner-portal", "performance-notices"],
    queryFn: getMyPerformanceNotices,
  });
}

export function useAcknowledgePerformanceNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (noticeId: string) => acknowledgePerformanceNotice(noticeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-portal", "performance-notices"] });
      toast.success("Notice acknowledged");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to acknowledge notice"),
  });
}

// Capability Refresh
export function useCapabilityRefreshStatus() {
  return useQuery({
    queryKey: ["partner-portal", "capability-refresh", "status"],
    queryFn: getCapabilityRefreshStatus,
  });
}

export function useSubmitCapabilityRefresh() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CapabilityRefreshRequest) => submitCapabilityRefresh(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-portal", "capability-refresh"] });
      queryClient.invalidateQueries({ queryKey: ["partner-portal", "profile"] });
      toast.success("Annual capability refresh submitted successfully");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to submit capability refresh"),
  });
}

// Scorecard
export function useMyScorecard(period: ScorecardPeriod = "90d") {
  return useQuery({
    queryKey: ["partner-portal", "scorecard", period],
    queryFn: () => getMyScorecard(period),
  });
}

// Onboarding
export function usePartnerOnboarding() {
  const { data: profile } = usePartnerProfile();
  const partnerId = profile?.id;

  return useQuery({
    queryKey: ["partner-portal", "onboarding", partnerId],
    queryFn: () => getPartnerOnboarding(partnerId!),
    enabled: !!partnerId,
  });
}

// Performance status vs thresholds
export function useMyPerformanceStatus() {
  return useQuery({
    queryKey: ["partner-portal", "performance-status"],
    queryFn: getMyPerformanceStatus,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

// Payments
export function useMyPayments(params?: PaymentListParams) {
  return useQuery({
    queryKey: ["partner-portal", "payments", params],
    queryFn: () => getMyPayments(params),
  });
}

export function useMyPaymentSummary() {
  return useQuery({
    queryKey: ["partner-portal", "payments", "summary"],
    queryFn: getMyPaymentSummary,
  });
}
