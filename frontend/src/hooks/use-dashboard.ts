
import { useQuery } from "@tanstack/react-query";
import {
  getProgramHealth,
  getPortfolioSummary,
  getAtRiskPrograms,
  getRealTimeStats,
  getActivityFeed,
  getDashboardAlerts,
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

export function useRealTimeStats() {
  return useQuery({
    queryKey: ["dashboard", "real-time-stats"],
    queryFn: () => getRealTimeStats(),
    refetchInterval: 30_000,
  });
}

export function useActivityFeed(skip = 0, limit = 50) {
  return useQuery({
    queryKey: ["dashboard", "activity-feed", skip, limit],
    queryFn: () => getActivityFeed(skip, limit),
    refetchInterval: 30_000,
  });
}

export function useDashboardAlerts() {
  return useQuery({
    queryKey: ["dashboard", "alerts"],
    queryFn: () => getDashboardAlerts(),
    refetchInterval: 30_000,
  });
}
