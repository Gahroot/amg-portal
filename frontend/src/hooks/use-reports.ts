"use client";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getPortfolioOverview,
  getProgramStatusReport,
  getCompletionReport,
  getAnnualReview,
  exportPortfolioOverview,
  exportProgramStatusReport,
  exportCompletionReport,
  exportAnnualReview,
} from "@/lib/api/reports";

export function usePortfolioOverview() {
  return useQuery({
    queryKey: ["reports", "portfolio"],
    queryFn: () => getPortfolioOverview(),
  });
}

export function useProgramStatusReport(programId: string) {
  return useQuery({
    queryKey: ["reports", "program-status", programId],
    queryFn: () => getProgramStatusReport(programId),
    enabled: !!programId,
  });
}

export function useCompletionReport(programId: string) {
  return useQuery({
    queryKey: ["reports", "completion", programId],
    queryFn: () => getCompletionReport(programId),
    enabled: !!programId,
  });
}

export function useAnnualReview(year: number) {
  return useQuery({
    queryKey: ["reports", "annual", year],
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
