import { useQuery } from "@tanstack/react-query";
import {
  getMyDecisionHistory,
  type DecisionHistoryParams,
} from "@/lib/api/client-portal";

export function usePortalDecisionHistory(params: DecisionHistoryParams = {}) {
  return useQuery({
    queryKey: ["portal", "decisions", "history", params],
    queryFn: () => getMyDecisionHistory(params),
  });
}
