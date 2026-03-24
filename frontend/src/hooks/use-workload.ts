
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getWorkloadOverview,
  getStaffAssignments,
  assignStaffToProgram,
  unassignStaffFromProgram,
} from "@/lib/api/workload";

export function useWorkload() {
  return useQuery({
    queryKey: ["workload"],
    queryFn: () => getWorkloadOverview(),
  });
}

export function useStaffAssignments(userId: string) {
  return useQuery({
    queryKey: ["workload", userId, "assignments"],
    queryFn: () => getStaffAssignments(userId),
    enabled: !!userId,
  });
}

export function useAssignStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      program_id: string;
      user_id: string;
      role: "relationship_manager" | "coordinator" | "backup";
    }) => assignStaffToProgram(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workload"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to assign staff to program"),
  });
}

export function useUnassignStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { program_id: string; user_id: string }) =>
      unassignStaffFromProgram(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workload"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to unassign staff from program"),
  });
}
