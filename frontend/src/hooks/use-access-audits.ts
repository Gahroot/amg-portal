
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listAccessAudits,
  getAccessAudit,
  createAccessAudit,
  updateAccessAudit,
  completeAccessAudit,
  getAccessAuditStatistics,
  getCurrentQuarterAudit,
  listAuditFindings,
  createAuditFinding,
  updateAuditFinding,
  acknowledgeFinding,
  remediateFinding,
  waiveFinding,
} from "@/lib/api/access-audits";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  AccessAuditListParams,
  AuditFindingListParams,
  CreateAccessAuditRequest,
  UpdateAccessAuditRequest,
  CreateAccessAuditFindingRequest,
  UpdateAccessAuditFindingRequest,
  RemediateFindingRequest,
  WaiveFindingRequest,
} from "@/types/access-audit";

export function useAccessAudits(params?: AccessAuditListParams) {
  return useQuery({
    queryKey: queryKeys.accessAudits.list(params),
    queryFn: () => listAccessAudits(params),
  });
}

export function useAccessAudit(id: string) {
  return useQuery({
    queryKey: queryKeys.accessAudits.detail(id),
    queryFn: () => getAccessAudit(id),
    enabled: !!id,
  });
}

export function useAccessAuditStatistics() {
  return useQuery({
    queryKey: queryKeys.accessAudits.statistics(),
    queryFn: () => getAccessAuditStatistics(),
  });
}

export function useCurrentQuarterAudit() {
  return useQuery({
    queryKey: queryKeys.accessAudits.current(),
    queryFn: () => getCurrentQuarterAudit(),
  });
}

export function useAuditFindings(params?: AuditFindingListParams) {
  return useQuery({
    queryKey: queryKeys.accessAudits.findings(params),
    queryFn: () => listAuditFindings(params),
  });
}

export function useCreateAccessAudit() {
  return useCrudMutation({
    mutationFn: (data: CreateAccessAuditRequest) => createAccessAudit(data),
    invalidateKeys: [queryKeys.accessAudits.all],
    errorMessage: "Failed to create access audit",
  });
}

export function useUpdateAccessAudit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateAccessAuditRequest;
    }) => updateAccessAudit(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accessAudits.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.accessAudits.detail(variables.id),
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update access audit"),
  });
}

export function useCompleteAccessAudit() {
  return useCrudMutation({
    mutationFn: (id: string) => completeAccessAudit(id),
    invalidateKeys: [queryKeys.accessAudits.all],
    errorMessage: "Failed to complete access audit",
  });
}

export function useCreateAuditFinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      auditId,
      data,
    }: {
      auditId: string;
      data: CreateAccessAuditFindingRequest;
    }) => createAuditFinding(auditId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accessAudits.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.accessAudits.detail(variables.auditId),
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create audit finding"),
  });
}

export function useUpdateAuditFinding() {
  return useCrudMutation({
    mutationFn: ({
      findingId,
      data,
    }: {
      findingId: string;
      data: UpdateAccessAuditFindingRequest;
    }) => updateAuditFinding(findingId, data),
    invalidateKeys: [queryKeys.accessAudits.all],
    errorMessage: "Failed to update audit finding",
  });
}

export function useAcknowledgeFinding() {
  return useCrudMutation({
    mutationFn: ({
      findingId,
      notes,
    }: {
      findingId: string;
      notes?: string;
    }) => acknowledgeFinding(findingId, { notes }),
    invalidateKeys: [queryKeys.accessAudits.all],
    errorMessage: "Failed to acknowledge finding",
  });
}

export function useRemediateFinding() {
  return useCrudMutation({
    mutationFn: ({
      findingId,
      data,
    }: {
      findingId: string;
      data: RemediateFindingRequest;
    }) => remediateFinding(findingId, data),
    invalidateKeys: [queryKeys.accessAudits.all],
    errorMessage: "Failed to remediate finding",
  });
}

export function useWaiveFinding() {
  return useCrudMutation({
    mutationFn: ({
      findingId,
      data,
    }: {
      findingId: string;
      data: WaiveFindingRequest;
    }) => waiveFinding(findingId, data),
    invalidateKeys: [queryKeys.accessAudits.all],
    errorMessage: "Failed to waive finding",
  });
}
