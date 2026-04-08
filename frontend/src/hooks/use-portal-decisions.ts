import { useQuery } from "@tanstack/react-query";
import {
  getMyDecisionHistory,
  type DecisionHistoryParams,
} from "@/lib/api/client-portal";
import { queryKeys } from "@/lib/query-keys";

export function usePortalDecisionHistory(params: DecisionHistoryParams = {}) {
  return useQuery({
    queryKey: queryKeys.portal.decisions.history(params),
    queryFn: () => getMyDecisionHistory(params),
  });
}
