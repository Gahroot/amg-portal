
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listAuditLogs,
  getAuditLog,
  getEntityAuditHistory,
  exportAuditLogsCsv,
} from "@/lib/api/audit-logs";
import type { AuditLogListParams } from "@/lib/api/audit-logs";

export function useAuditLogs(params?: AuditLogListParams) {
  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => listAuditLogs(params),
  });
}

export function useAuditLog(id: string) {
  return useQuery({
    queryKey: ["audit-logs", id],
    queryFn: () => getAuditLog(id),
    enabled: !!id,
  });
}

export function useEntityAuditHistory(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ["audit-logs", "entity", entityType, entityId],
    queryFn: () => getEntityAuditHistory(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
}

export function useExportAuditLogs() {
  return useMutation({
    mutationFn: (params?: AuditLogListParams) => exportAuditLogsCsv(params),
    onError: (error: Error) =>
      toast.error(error.message || "Failed to export audit logs"),
  });
}
