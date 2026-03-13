"use client";

import { useQuery } from "@tanstack/react-query";
import {
  listProgramRiskScores,
  getProgramHealth,
  getClientRiskOverview,
  listRiskAlerts,
  listPredictiveRiskAlerts,
} from "@/lib/api/risk-forecast";
import type { RiskForecastListParams } from "@/types/risk-forecast";

export function useProgramRiskScores(params?: RiskForecastListParams) {
  return useQuery({
    queryKey: ["risk-forecast", "programs", params],
    queryFn: () => listProgramRiskScores(params),
  });
}

export function useProgramHealth(programId: string) {
  return useQuery({
    queryKey: ["risk-forecast", "programs", programId],
    queryFn: () => getProgramHealth(programId),
    enabled: !!programId,
  });
}

export function useClientRiskOverview(clientId: string) {
  return useQuery({
    queryKey: ["risk-forecast", "clients", clientId],
    queryFn: () => getClientRiskOverview(clientId),
    enabled: !!clientId,
  });
}

export function useRiskAlerts(params?: { skip?: number; limit?: number }) {
  return useQuery({
    queryKey: ["risk-forecast", "alerts", params],
    queryFn: () => listRiskAlerts(params),
    refetchInterval: 60 * 1000,
  });
}

export function usePredictiveRiskAlerts(params?: {
  skip?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["risk-forecast", "predictive", params],
    queryFn: () => listPredictiveRiskAlerts(params),
    refetchInterval: 60 * 1000,
  });
}
