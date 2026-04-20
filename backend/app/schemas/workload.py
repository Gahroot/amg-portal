"""Workload schema for staff assignment tracking."""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.base import Str50, Str100, Str255


class StaffWorkloadItem(BaseModel):
    user_id: Str100
    user_name: Str255
    user_email: Str255
    role: Str50
    active_programs: int
    pending_tasks: int
    open_escalations: int
    pending_approvals: int
    active_assignments: int
    workload_score: int
    capacity_status: Str50  # available, at_capacity, overloaded


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
    id: Str100
    program_id: Str100
    program_title: Str255
    client_name: Str255
    role: Str50  # relationship_manager, coordinator, backup
    assigned_at: Str50
    program_status: Str50
    active_escalations: int


class StaffAssignmentsResponse(BaseModel):
    assignments: list[StaffAssignmentItem]
    total: int


class AssignStaffRequest(BaseModel):
    program_id: Str100
    user_id: Str100
    role: Str50  # relationship_manager, coordinator, backup
