"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getProgramHealth,
  getPortfolioSummary,
  getAtRiskPrograms,
  getPartnerScorecard,
  getPartnerRankings,
} from "@/lib/api/dashboard";

export function useProgramHealth() {
  return useQuery({
    queryKey: ["dashboard", "program-health"],
    queryFn: () => getProgramHealth(),
  });
}

export function usePortfolioSummary() {
  return useQuery({
    queryKey: ["dashboard", "portfolio-summary"],
    queryFn: () => getPortfolioSummary(),
  });
}

export function useAtRiskPrograms() {
  return useQuery({
    queryKey: ["dashboard", "at-risk-programs"],
    queryFn: () => getAtRiskPrograms(),
  });
}

export function usePartnerScorecard(partnerId: string) {
  return useQuery({
    queryKey: ["partner-scoring", "scorecard", partnerId],
    queryFn: () => getPartnerScorecard(partnerId),
    enabled: !!partnerId,
  });
}

export function usePartnerRankings(skip = 0, limit = 50) {
  return useQuery({
    queryKey: ["partner-scoring", "rankings", skip, limit],
    queryFn: () => getPartnerRankings(skip, limit),
  });
}
