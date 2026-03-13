"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listComplianceReports,
  generateComplianceReport,
  downloadComplianceReport,
} from "@/lib/api/compliance-reports";
import type {
  ComplianceReportListParams,
  ComplianceReportGenerateRequest,
} from "@/types/compliance-report";

export function useComplianceReports(params?: ComplianceReportListParams) {
  return useQuery({
    queryKey: ["compliance-reports", params],
    queryFn: () => listComplianceReports(params),
  });
}

export function useGenerateComplianceReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ComplianceReportGenerateRequest) =>
      generateComplianceReport(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-reports"] });
      toast.success("Report generation started");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to generate report"),
  });
}

export function useDownloadComplianceReport() {
  const downloadFn = async (id: string) => {
    try {
      await downloadComplianceReport(id);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to download report";
      toast.error(message);
      throw error;
    }
  };
  return { downloadReport: downloadFn };
}
