
import { useQuery } from "@tanstack/react-query";
import {
  getMyPortalPrograms,
  getMyPortalProgram,
  getMyPortalMilestones,
  type GetMyMilestonesParams,
} from "@/lib/api/client-portal";
import { queryKeys } from "@/lib/query-keys";

export function usePortalPrograms() {
  return useQuery({
    queryKey: queryKeys.portal.programs.all,
    queryFn: getMyPortalPrograms,
  });
}

export function usePortalProgram(id: string) {
  return useQuery({
    queryKey: queryKeys.portal.programs.detail(id),
    queryFn: () => getMyPortalProgram(id),
    enabled: !!id,
  });
}

export function usePortalMilestones(params?: GetMyMilestonesParams) {
  return useQuery({
    queryKey: queryKeys.portal.milestones(params),
    queryFn: () => getMyPortalMilestones(params),
  });
}
