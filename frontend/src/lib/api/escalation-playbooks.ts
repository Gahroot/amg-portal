import api from "@/lib/api";

export interface PlaybookStep {
  order: number;
  title: string;
  description: string;
  time_estimate_minutes: number | null;
  resources: Array<{ label: string; url: string | null }>;
}

export interface EscalationPath {
  condition: string;
  action: string;
  contact_role: string | null;
}

export interface Playbook {
  id: string;
  escalation_type: string;
  name: string;
  description: string | null;
  steps: PlaybookStep[];
  success_criteria: string[];
  escalation_paths: EscalationPath[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlaybookListResponse {
  playbooks: Playbook[];
  total: number;
}

export interface StepState {
  step_order: number;
  completed: boolean;
  skipped: boolean;
  skip_reason: string | null;
  notes: string | null;
  completed_at: string | null;
  completed_by: string | null;
}

export interface ProgressSummary {
  completed: number;
  skipped: number;
  total: number;
  percentage: number;
}

export interface PlaybookExecution {
  id: string;
  playbook_id: string;
  escalation_id: string;
  status: string;
  step_states: StepState[];
  started_by: string;
  completed_steps: number;
  total_steps: number;
  completed_at: string | null;
  progress: ProgressSummary;
  created_at: string;
  updated_at: string;
}

export interface SuggestedAction {
  type: string;
  label: string;
  description: string;
  action?: string;
  role?: string;
}

export interface PlaybookWithExecution {
  playbook: Playbook;
  execution: PlaybookExecution | null;
  suggested_actions: SuggestedAction[];
}

export interface StepStateUpdate {
  step_order: number;
  completed?: boolean;
  skipped?: boolean;
  skip_reason?: string;
  notes?: string;
}

export async function getEscalationPlaybook(
  escalationId: string,
): Promise<PlaybookWithExecution> {
  const response = await api.get<PlaybookWithExecution>(
    `/api/v1/escalations/${escalationId}/playbook`,
  );
  return response.data;
}

export async function updatePlaybookStep(
  escalationId: string,
  update: StepStateUpdate,
): Promise<PlaybookExecution> {
  const response = await api.patch<PlaybookExecution>(
    `/api/v1/escalations/${escalationId}/playbook/steps`,
    update,
  );
  return response.data;
}

export async function listPlaybooks(params?: {
  is_active?: boolean;
  escalation_type?: string;
}): Promise<PlaybookListResponse> {
  const response = await api.get<PlaybookListResponse>(
    "/api/v1/escalations/playbooks/list",
    { params },
  );
  return response.data;
}

export async function seedPlaybooks(): Promise<void> {
  await api.post("/api/v1/escalations/playbooks/seed");
}
