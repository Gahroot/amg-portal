export interface DeletionRequest {
  id: string;
  entity_type: string;
  entity_id: string;
  requested_by: string;
  requested_at: string;
  reason: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  status: "pending" | "approved" | "rejected" | "expired";
  executed_at: string | null;
}

export interface DeletionRequestListResponse {
  requests: DeletionRequest[];
  total: number;
}

export interface DeletionRequestCreate {
  entity_type: string;
  entity_id: string;
  reason: string;
}

export interface RejectDeletionRequest {
  reason: string;
}

export interface DeletionRequestListParams {
  status?: string;
  entity_type?: string;
  skip?: number;
  limit?: number;
}
