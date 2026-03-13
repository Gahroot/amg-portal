export type DeletionRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executed"
  | "expired";

export type DeletionEntityType = "client_profile" | "document" | "program";

export interface DeletionRequest {
  id: string;
  entity_type: DeletionEntityType;
  entity_id: string;
  reason: string;
  requested_by: string;
  approved_by: string | null;
  status: DeletionRequestStatus;
  retention_days: number;
  scheduled_purge_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeletionRequestListResponse {
  deletion_requests: DeletionRequest[];
  total: number;
}

export interface DeletionRequestCreateData {
  entity_type: DeletionEntityType;
  entity_id: string;
  reason: string;
  retention_days?: number;
}

export interface DeletionRequestRejectData {
  reason: string;
}
