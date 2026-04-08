
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getProgramHealth,
  getPortfolioSummary,
  getRealTimeStats,
  getActivityFeed,
  getDashboardAlerts,
  getPartnerScorecard,
  getPartnerRankings,
  type ProgramHealthResponse,
} from "@/lib/api/dashboard";
import { queryKeys } from "@/lib/query-keys";

interface QueryOptions {
  enabled?: boolean;
}

export function useProgramHealth() {
  return useQuery({
    queryKey: queryKeys.dashboard.programHealth(),
    queryFn: () => getProgramHealth(),
  });
}

export function usePortfolioSummary(options?: QueryOptions) {
  return useQuery({
    queryKey: queryKeys.dashboard.portfolioSummary(),
    queryFn: () => getPortfolioSummary(),
    enabled: options?.enabled,
  });
}

/**
 * Derives at-risk programs from the program health cache — no extra API call.
 * A program is "at risk" when its RAG status is red OR it has active escalations.
 */
export function useAtRiskPrograms(options?: QueryOptions) {
  const health = useQuery({
    queryKey: queryKeys.dashboard.programHealth(),
    queryFn: () => getProgramHealth(),
    enabled: options?.enabled,
  });

  const atRisk = useMemo<ProgramHealthResponse | undefined>(() => {
    if (!health.data) return undefined;
    const programs = health.data.programs.filter(
      (p) => p.rag_status === "red" || p.active_escalation_count > 0,
    );
    return { programs, total: programs.length };
  }, [health.data]);

  return { ...health, data: atRisk };
}

export function usePartnerScorecard(partnerId: string) {
  return useQuery({
    queryKey: queryKeys.partnerScoring.scorecard(partnerId),
    queryFn: () => getPartnerScorecard(partnerId),
    enabled: !!partnerId,
  });
}

export function usePartnerRankings(skip = 0, limit = 50) {
  return useQuery({
    queryKey: queryKeys.partnerScoring.rankings(skip, limit),
    queryFn: () => getPartnerRankings(skip, limit),
  });
}

export function useRealTimeStats(options?: QueryOptions) {
  return useQuery({
    queryKey: queryKeys.dashboard.realTimeStats(),
    queryFn: () => getRealTimeStats(),
    refetchOnWindowFocus: true,
    enabled: options?.enabled,
  });
}

export function useActivityFeed(options?: QueryOptions & { skip?: number; limit?: number }) {
  const skip = options?.skip ?? 0;
  const limit = options?.limit ?? 50;
  return useQuery({
    queryKey: queryKeys.dashboard.activityFeed(skip, limit),
    queryFn: () => getActivityFeed(skip, limit),
    refetchOnWindowFocus: true,
    enabled: options?.enabled,
  });
}

export function useDashboardAlerts(options?: QueryOptions) {
  return useQuery({
    queryKey: queryKeys.dashboard.alerts(),
    queryFn: () => getDashboardAlerts(),
    refetchOnWindowFocus: true,
    enabled: options?.enabled,
  });
}
