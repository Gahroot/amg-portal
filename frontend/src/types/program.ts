/**
 * Program types — re-exported from generated OpenAPI types where possible.
 *
 * API types are sourced from generated.ts (auto-generated from FastAPI OpenAPI schema).
 * Frontend-only types (UI state, constants, query params) remain manual.
 *
 * To refresh: npm run generate:types (requires backend at localhost:8000)
 *
 * @see backend/app/schemas/program.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type ProgramStatus = components["schemas"]["ProgramStatus"];
export type MilestoneStatus = components["schemas"]["MilestoneStatus"];
export type TaskStatus = components["schemas"]["TaskStatus"];
export type TaskPriority = components["schemas"]["TaskPriority"];

export type Program = components["schemas"]["ProgramResponse"];
export type ProgramCreate = components["schemas"]["ProgramCreate"];
export type ProgramUpdate = components["schemas"]["ProgramUpdate"];
export type ProgramListResponse = components["schemas"]["ProgramListResponse"];
export type ProgramDetail = components["schemas"]["ProgramDetailResponse"];
export type ProgramSummary = components["schemas"]["ProgramSummary"];
export type ProgramSummaryMilestone = components["schemas"]["ProgramSummaryMilestone"];

export type Milestone = components["schemas"]["MilestoneResponse"];
export type MilestoneCreate = components["schemas"]["MilestoneCreate"];
export type MilestoneUpdate = components["schemas"]["MilestoneUpdate"];

export type Task = components["schemas"]["TaskResponse"];
export type TaskCreate = components["schemas"]["TaskCreate"];
export type TaskUpdate = components["schemas"]["TaskUpdate"];

// ---------------------------------------------------------------------------
// Frontend-only types — query params
// ---------------------------------------------------------------------------

export interface ProgramListParams {
  status?: ProgramStatus;
  client_id?: string;
  search?: string;
  skip?: number;
  limit?: number;
}
