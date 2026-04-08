
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getPortfolioOverview,
  getProgramStatusReport,
  getPortalProgramStatuses,
  getPortalProgramStatus,
  getCompletionReport,
  getAnnualReview,
  exportPortfolioOverview,
  exportProgramStatusReport,
  exportCompletionReport,
  exportAnnualReview,
  downloadPortfolioPDF,
  downloadProgramStatusPDF,
  downloadCompletionPDF,
  downloadAnnualReviewPDF,
} from "@/lib/api/reports";
import { queryKeys } from "@/lib/query-keys";

export function usePortfolioOverview() {
  return useQuery({
    queryKey: queryKeys.reports.portfolio(),
    queryFn: () => getPortfolioOverview(),
  });
}

export function useProgramStatusReport(programId: string) {
  return useQuery({
    queryKey: queryKeys.reports.programStatus(programId),
    queryFn: () => getProgramStatusReport(programId),
    enabled: !!programId,
  });
}

export function useCompletionReport(programId: string) {
  return useQuery({
    queryKey: queryKeys.reports.completion(programId),
    queryFn: () => getCompletionReport(programId),
    enabled: !!programId,
  });
}

export function useAnnualReview(year: number) {
  return useQuery({
    queryKey: queryKeys.reports.annual(year),
    queryFn: () => getAnnualReview(year),
    enabled: !!year,
  });
}

export function useExportPortfolio() {
  const exportFn = async () => {
    try {
      await exportPortfolioOverview();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export portfolio report";
      toast.error(message);
      throw error;
    }
  };
  return { exportPortfolio: exportFn };
}

export function useExportProgramStatus() {
  const exportFn = async (programId: string) => {
    try {
      await exportProgramStatusReport(programId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export program status report";
      toast.error(message);
      throw error;
    }
  };
  return { exportProgramStatus: exportFn };
}

export function useExportCompletion() {
  const exportFn = async (programId: string) => {
    try {
      await exportCompletionReport(programId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export completion report";
      toast.error(message);
      throw error;
    }
  };
  return { exportCompletion: exportFn };
}

export function useExportAnnualReview() {
  const exportFn = async (year: number) => {
    try {
      await exportAnnualReview(year);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export annual review";
      toast.error(message);
      throw error;
    }
  };
  return { exportAnnualReview: exportFn };
}

export function usePortalProgramStatuses() {
  return useQuery({
    queryKey: queryKeys.portal.programStatuses(),
    queryFn: () => getPortalProgramStatuses(),
  });
}

export function usePortalProgramStatus(programId: string) {
  return useQuery({
    queryKey: queryKeys.portal.programStatus(programId),
    queryFn: () => getPortalProgramStatus(programId),
    enabled: !!programId,
  });
}

export function useDownloadPortfolioPDF() {
  const downloadFn = async () => {
    try {
      await downloadPortfolioPDF();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download portfolio PDF";
      toast.error(message);
      throw error;
    }
  };
  return { downloadPortfolioPDF: downloadFn };
}

export function useDownloadProgramStatusPDF() {
  const downloadFn = async (programId: string) => {
    try {
      await downloadProgramStatusPDF(programId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download program status PDF";
      toast.error(message);
      throw error;
    }
  };
  return { downloadProgramStatusPDF: downloadFn };
}

export function useDownloadCompletionPDF() {
  const downloadFn = async (programId: string) => {
    try {
      await downloadCompletionPDF(programId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download completion PDF";
      toast.error(message);
      throw error;
    }
  };
  return { downloadCompletionPDF: downloadFn };
}

export function useDownloadAnnualReviewPDF() {
  const downloadFn = async (year: number) => {
    try {
      await downloadAnnualReviewPDF(year);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download annual review PDF";
      toast.error(message);
      throw error;
    }
  };
  return { downloadAnnualReviewPDF: downloadFn };
}
