"""Workload schema for staff assignment tracking."""

from __future__ import annotations

from pydantic import BaseModel


class StaffWorkloadItem(BaseModel):
    user_id: str
    user_name: str
    user_email: str
    role: str
    active_programs: int
    pending_tasks: int
    open_escalations: int
    pending_approvals: int
    active_assignments: int
    workload_score: int
    capacity_status: str  # available, at_capacity, overloaded


class WorkloadSummary(BaseModel):
    total_staff: int
    available_staff: int
    at_capacity_staff: int
    overloaded_staff: int
    total_open_escalations: int
    total_pending_approvals: int


class WorkloadResponse(BaseModel):
    staff: list[StaffWorkloadItem]
    summary: WorkloadSummary


class StaffAssignmentItem(BaseModel):
    id: str
    program_id: str
    program_title: str
    client_name: str
    role: str  # relationship_manager, coordinator, backup
    assigned_at: str
    program_status: str
    active_escalations: int


class StaffAssignmentsResponse(BaseModel):
    assignments: list[StaffAssignmentItem]
    total: int


class AssignStaffRequest(BaseModel):
    program_id: str
    user_id: str
    role: str  # relationship_manager, coordinator, backup


# ============================================================================
# Capacity Planning
# ============================================================================


class CapacityItem(BaseModel):
    """Capacity view for a single staff member."""

    user_id: str
    user_name: str
    user_email: str
    role: str
    active_programs: int
    open_tasks: int
    max_programs: int
    utilization_pct: float  # 0–100
    is_over_capacity: bool
    capacity_status: str  # available, at_capacity, over_capacity


class CapacitySummary(BaseModel):
    total_staff: int
    available_count: int
    at_capacity_count: int
    over_capacity_count: int
    avg_utilization_pct: float


class CapacityResponse(BaseModel):
    staff: list[CapacityItem]
    summary: CapacitySummary
