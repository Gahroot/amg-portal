"use client";

import { useQuery } from "@tanstack/react-query";
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
    await exportPortfolioOverview();
  };
  return { exportPortfolio: exportFn };
}

export function useExportProgramStatus() {
  const exportFn = async (programId: string) => {
    await exportProgramStatusReport(programId);
  };
  return { exportProgramStatus: exportFn };
}

export function useExportCompletion() {
  const exportFn = async (programId: string) => {
    await exportCompletionReport(programId);
  };
  return { exportCompletion: exportFn };
}

export function useExportAnnualReview() {
  const exportFn = async (year: number) => {
    await exportAnnualReview(year);
  };
  return { exportAnnualReview: exportFn };
}
