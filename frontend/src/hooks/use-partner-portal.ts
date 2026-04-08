
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
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";

// Profile
export function usePartnerProfile() {
  return useQuery({
    queryKey: queryKeys.partnerPortal.profile(),
    queryFn: getMyProfile,
  });
}

// Assignments
export function usePartnerAssignments(params?: AssignmentListParams) {
  return useQuery({
    queryKey: queryKeys.partnerPortal.assignments.list(params),
    queryFn: () => getMyAssignments(params),
  });
}

export function usePartnerAssignment(id: string) {
  return useQuery({
    queryKey: queryKeys.partnerPortal.assignments.detail(id),
    queryFn: () => getMyAssignment(id),
    enabled: !!id,
  });
}

// Deliverables
export function usePartnerDeliverables(params?: DeliverableListParams) {
  return useQuery({
    queryKey: queryKeys.partnerPortal.deliverables.list(params),
    queryFn: () => getMyDeliverables(params),
  });
}

export function usePartnerDeliverable(id: string) {
  return useQuery({
    queryKey: queryKeys.partnerPortal.deliverables.detail(id),
    queryFn: () => getMyDeliverable(id),
    enabled: !!id,
  });
}

export function useSubmitPartnerDeliverable() {
  return useCrudMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => submitDeliverable(id, file),
    invalidateKeys: [queryKeys.partnerPortal.deliverables.all],
    successMessage: "Deliverable submitted successfully",
    errorMessage: "Failed to submit deliverable",
  });
}

// Documents
export function useAssignmentDocuments(assignmentId: string) {
  return useQuery({
    queryKey: queryKeys.partnerPortal.assignments.documents(assignmentId),
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
    queryKey: queryKeys.partnerPortal.conversations.list(params),
    queryFn: () => getMyConversations(params),
  });
}

export function usePartnerConversation(conversationId: string) {
  return useQuery({
    queryKey: queryKeys.partnerPortal.conversations.detail(conversationId),
    queryFn: () => getMyConversation(conversationId),
    enabled: !!conversationId,
  });
}

export function usePartnerMessages(conversationId: string, params?: { skip?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.partnerPortal.conversations.messages(conversationId, params),
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
        queryKey: queryKeys.partnerPortal.conversations.messagesAll(variables.conversationId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.partnerPortal.conversations.all });
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
        queryKey: queryKeys.partnerPortal.conversations.detail(conversationId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.partnerPortal.conversations.all });
    },
  });
}

// Partner Reports (Class C)
export function usePartnerBriefSummary() {
  return useQuery({
    queryKey: queryKeys.partnerPortal.reports.briefSummary(),
    queryFn: getPartnerBriefSummary,
  });
}

export function usePartnerDeliverableFeedback(assignmentId?: string) {
  return useQuery({
    queryKey: queryKeys.partnerPortal.reports.deliverableFeedback(assignmentId),
    queryFn: () => getPartnerDeliverableFeedback(assignmentId),
  });
}

export function usePartnerEngagementHistory() {
  return useQuery({
    queryKey: queryKeys.partnerPortal.reports.engagementHistory(),
    queryFn: getPartnerEngagementHistory,
  });
}

// Performance Notices
export function useMyPerformanceNotices() {
  return useQuery({
    queryKey: queryKeys.partnerPortal.performanceNotices(),
    queryFn: getMyPerformanceNotices,
  });
}

export function useAcknowledgePerformanceNotice() {
  return useCrudMutation({
    mutationFn: (noticeId: string) => acknowledgePerformanceNotice(noticeId),
    invalidateKeys: [queryKeys.partnerPortal.performanceNotices()],
    successMessage: "Notice acknowledged",
    errorMessage: "Failed to acknowledge notice",
  });
}

// Capability Refresh
export function useCapabilityRefreshStatus() {
  return useQuery({
    queryKey: queryKeys.partnerPortal.capabilityRefresh.status(),
    queryFn: getCapabilityRefreshStatus,
  });
}

export function useSubmitCapabilityRefresh() {
  return useCrudMutation({
    mutationFn: (data: CapabilityRefreshRequest) => submitCapabilityRefresh(data),
    invalidateKeys: [
      queryKeys.partnerPortal.capabilityRefresh.all,
      queryKeys.partnerPortal.profile(),
    ],
    successMessage: "Annual capability refresh submitted successfully",
    errorMessage: "Failed to submit capability refresh",
  });
}

// Scorecard
export function useMyScorecard(period: ScorecardPeriod = "90d") {
  return useQuery({
    queryKey: queryKeys.partnerPortal.scorecard(period),
    queryFn: () => getMyScorecard(period),
  });
}

// Onboarding
export function usePartnerOnboarding() {
  const { data: profile } = usePartnerProfile();
  const partnerId = profile?.id;

  return useQuery({
    queryKey: queryKeys.partnerPortal.onboarding(partnerId),
    queryFn: () => getPartnerOnboarding(partnerId!),
    enabled: !!partnerId,
  });
}

// Performance status vs thresholds
export function useMyPerformanceStatus() {
  return useQuery({
    queryKey: queryKeys.partnerPortal.performanceStatus(),
    queryFn: getMyPerformanceStatus,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

// Payments
export function useMyPayments(params?: PaymentListParams) {
  return useQuery({
    queryKey: queryKeys.partnerPortal.payments.list(params),
    queryFn: () => getMyPayments(params),
  });
}

export function useMyPaymentSummary() {
  return useQuery({
    queryKey: queryKeys.partnerPortal.payments.summary(),
    queryFn: getMyPaymentSummary,
  });
}
