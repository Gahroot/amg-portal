import api from "@/lib/api";

// ============================================================================
// Types
// ============================================================================

export interface ChecklistItem {
  key: string;
  label: string;
  completed: boolean;
}

export interface ProgramClosure {
  id: string;
  program_id: string;
  status: string;
  checklist: ChecklistItem[];
  notes: string | null;
  initiated_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerRating {
  id: string;
  program_id: string;
  partner_id: string;
  rated_by: string;
  quality_score: number;
  timeliness_score: number;
  communication_score: number;
  overall_score: number;
  comments: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerRatingCreate {
  partner_id: string;
  quality_score: number;
  timeliness_score: number;
  communication_score: number;
  overall_score: number;
  comments?: string;
}

// ============================================================================
// API Functions
// ============================================================================

export async function initiateClosure(
  programId: string,
  data: { program_id: string; notes?: string },
): Promise<ProgramClosure> {
  const response = await api.post<ProgramClosure>(
    `/api/v1/programs/${programId}/closure`,
    data,
  );
  return response.data;
}

export async function getClosureStatus(
  programId: string,
): Promise<ProgramClosure> {
  const response = await api.get<ProgramClosure>(
    `/api/v1/programs/${programId}/closure`,
  );
  return response.data;
}

export async function updateChecklist(
  programId: string,
  items: ChecklistItem[],
): Promise<ProgramClosure> {
  const response = await api.patch<ProgramClosure>(
    `/api/v1/programs/${programId}/closure/checklist`,
    { items },
  );
  return response.data;
}

export async function submitPartnerRating(
  programId: string,
  data: PartnerRatingCreate,
): Promise<PartnerRating> {
  const response = await api.post<PartnerRating>(
    `/api/v1/programs/${programId}/closure/partner-ratings`,
    data,
  );
  return response.data;
}

export async function getPartnerRatings(
  programId: string,
): Promise<PartnerRating[]> {
  const response = await api.get<PartnerRating[]>(
    `/api/v1/programs/${programId}/closure/partner-ratings`,
  );
  return response.data;
}

export async function completeClosure(
  programId: string,
): Promise<ProgramClosure> {
  const response = await api.post<ProgramClosure>(
    `/api/v1/programs/${programId}/closure/complete`,
  );
  return response.data;
}
