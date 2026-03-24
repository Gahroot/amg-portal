
import { useQuery } from "@tanstack/react-query";
import {
  getMyPortalPrograms,
  getMyPortalProgram,
  getMyPortalMilestones,
  type GetMyMilestonesParams,
} from "@/lib/api/client-portal";

export function usePortalPrograms() {
  return useQuery({
    queryKey: ["portal", "programs"],
    queryFn: getMyPortalPrograms,
  });
}

export function usePortalProgram(id: string) {
  return useQuery({
    queryKey: ["portal", "programs", id],
    queryFn: () => getMyPortalProgram(id),
    enabled: !!id,
  });
}

export function usePortalMilestones(params?: GetMyMilestonesParams) {
  return useQuery({
    queryKey: ["portal", "milestones", params],
    queryFn: () => getMyPortalMilestones(params),
  });
}
