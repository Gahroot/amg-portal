import api from "@/lib/api";

export interface StaffWorkloadItem {
  user_id: string;
  user_name: string;
  user_email: string;
  role: string;
  active_programs: number;
  pending_tasks: number;
  open_escalations: number;
  pending_approvals: number;
  active_assignments: number;
  workload_score: number;
  capacity_status: "available" | "at_capacity" | "overloaded";
}

export interface WorkloadSummary {
  total_staff: number;
  available_staff: number;
  at_capacity_staff: number;
  overloaded_staff: number;
  total_open_escalations: number;
  total_pending_approvals: number;
}

export interface WorkloadResponse {
  staff: StaffWorkloadItem[];
  summary: WorkloadSummary;
}

export interface StaffAssignment {
  id: string;
  program_id: string;
  program_title: string;
  client_name: string;
  role: "relationship_manager" | "coordinator" | "backup";
  assigned_at: string;
  program_status: string;
  active_escalations: number;
}

export interface StaffAssignmentsResponse {
  assignments: StaffAssignment[];
  total: number;
}

export async function getWorkloadOverview(): Promise<WorkloadResponse> {
  const response = await api.get<WorkloadResponse>("/api/v1/workload/");
  return response.data;
}

export async function getStaffAssignments(
  userId: string,
): Promise<StaffAssignmentsResponse> {
  const response = await api.get<StaffAssignmentsResponse>(
    `/api/v1/workload/${userId}/assignments`,
  );
  return response.data;
}

export async function assignStaffToProgram(data: {
  program_id: string;
  user_id: string;
  role: "relationship_manager" | "coordinator" | "backup";
}): Promise<void> {
  await api.post("/api/v1/workload/assign", data);
}

export async function unassignStaffFromProgram(data: {
  program_id: string;
  user_id: string;
}): Promise<void> {
  await api.post("/api/v1/workload/unassign", data);
}

// Capacity Planning

export interface CapacityItem {
  user_id: string;
  user_name: string;
  user_email: string;
  role: string;
  active_programs: number;
  open_tasks: number;
  max_programs: number;
  utilization_pct: number;
  is_over_capacity: boolean;
  capacity_status: "available" | "at_capacity" | "over_capacity";
}

export interface CapacitySummary {
  total_staff: number;
  available_count: number;
  at_capacity_count: number;
  over_capacity_count: number;
  avg_utilization_pct: number;
}

export interface CapacityResponse {
  staff: CapacityItem[];
  summary: CapacitySummary;
}

export async function getCapacityOverview(): Promise<CapacityResponse> {
  const response = await api.get<CapacityResponse>(
    "/api/v1/workload/capacity",
  );
  return response.data;
}
