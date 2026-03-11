export interface CapabilityReview {
  id: string;
  partner_id: string;
  review_year: number;
  status: "pending" | "scheduled" | "in_progress" | "completed" | "overdue" | "waived";
  reviewer_id: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  capabilities_reviewed: string[] | null;
  certifications_reviewed: string[] | null;
  qualifications_reviewed: string[] | null;
  findings: CapabilityReviewFinding[] | null;
  notes: string | null;
  recommendations: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
  partner_name: string | null;
  reviewer_name: string | null;
}

export interface CapabilityReviewFinding {
  finding_type: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  recommendation: string | null;
}

export interface CapabilityReviewListResponse {
  reviews: CapabilityReview[];
  total: number;
}

export interface CapabilityReviewStatistics {
  total: number;
  pending: number;
  scheduled: number;
  in_progress: number;
  completed: number;
  overdue: number;
  waived: number;
  by_year: Record<number, number>;
}

export interface CreateCapabilityReviewRequest {
  partner_id: string;
  review_year: number;
  reviewer_id?: string;
  scheduled_date?: string;
  notes?: string;
}

export interface UpdateCapabilityReviewRequest {
  status?: string;
  reviewer_id?: string;
  scheduled_date?: string;
  capabilities_reviewed?: string[];
  certifications_reviewed?: string[];
  qualifications_reviewed?: string[];
  findings?: CapabilityReviewFinding[];
  notes?: string;
  recommendations?: string;
}

export interface CompleteCapabilityReviewRequest {
  findings?: CapabilityReviewFinding[];
  recommendations?: string;
  notes?: string;
}

export interface GenerateAnnualReviewsRequest {
  review_year: number;
  scheduled_date?: string;
}

export interface CapabilityReviewListParams {
  skip?: number;
  limit?: number;
  status?: string;
  partner_id?: string;
  year?: number;
}
