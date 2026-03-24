
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
    queryKey: ["access-audits", params],
    queryFn: () => listAccessAudits(params),
  });
}

export function useAccessAudit(id: string) {
  return useQuery({
    queryKey: ["access-audits", id],
    queryFn: () => getAccessAudit(id),
    enabled: !!id,
  });
}

export function useAccessAuditStatistics() {
  return useQuery({
    queryKey: ["access-audits", "statistics"],
    queryFn: () => getAccessAuditStatistics(),
  });
}

export function useCurrentQuarterAudit() {
  return useQuery({
    queryKey: ["access-audits", "current"],
    queryFn: () => getCurrentQuarterAudit(),
  });
}

export function useAuditFindings(params?: AuditFindingListParams) {
  return useQuery({
    queryKey: ["access-audits", "findings", params],
    queryFn: () => listAuditFindings(params),
  });
}

export function useCreateAccessAudit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAccessAuditRequest) => createAccessAudit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-audits"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create access audit"),
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
      queryClient.invalidateQueries({ queryKey: ["access-audits"] });
      queryClient.invalidateQueries({
        queryKey: ["access-audits", variables.id],
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update access audit"),
  });
}

export function useCompleteAccessAudit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => completeAccessAudit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-audits"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to complete access audit"),
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
      queryClient.invalidateQueries({ queryKey: ["access-audits"] });
      queryClient.invalidateQueries({
        queryKey: ["access-audits", variables.auditId],
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create audit finding"),
  });
}

export function useUpdateAuditFinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      findingId,
      data,
    }: {
      findingId: string;
      data: UpdateAccessAuditFindingRequest;
    }) => updateAuditFinding(findingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-audits"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update audit finding"),
  });
}

export function useAcknowledgeFinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      findingId,
      notes,
    }: {
      findingId: string;
      notes?: string;
    }) => acknowledgeFinding(findingId, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-audits"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to acknowledge finding"),
  });
}

export function useRemediateFinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      findingId,
      data,
    }: {
      findingId: string;
      data: RemediateFindingRequest;
    }) => remediateFinding(findingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-audits"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to remediate finding"),
  });
}

export function useWaiveFinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      findingId,
      data,
    }: {
      findingId: string;
      data: WaiveFindingRequest;
    }) => waiveFinding(findingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-audits"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to waive finding"),
  });
}
