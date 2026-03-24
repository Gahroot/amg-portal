import api from "@/lib/api";

// Feedback types
export interface FeedbackTypeOption {
  value: string;
  label: string;
  description: string;
}

export interface FeedbackTypesResponse {
  types: FeedbackTypeOption[];
}

export interface FeedbackCreateData {
  feedback_type: string;
  description: string;
  page_url?: string;
  screenshot_url?: string;
  email?: string;
  user_agent?: string;
  extra_data?: Record<string, unknown>;
}

export interface FeedbackResponse {
  id: string;
  user_id: string | null;
  feedback_type: string;
  description: string;
  page_url: string | null;
  screenshot_url: string | null;
  email: string | null;
  status: string;
  priority: string | null;
  assigned_to: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  extra_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  user_name: string | null;
  user_email: string | null;
  assignee_name: string | null;
}

export interface FeedbackListResponse {
  feedback: FeedbackResponse[];
  total: number;
}

export interface FeedbackListParams {
  status?: string;
  feedback_type?: string;
  priority?: string;
  assigned_to?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface FeedbackSummary {
  total: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
  unassigned_count: number;
  open_count: number;
  resolved_this_week: number;
}

export interface FeedbackUpdateData {
  status?: string;
  priority?: string;
  assigned_to?: string;
  resolution_notes?: string;
  internal_notes?: string;
}

// API functions

/**
 * Get available feedback types
 */
export async function getFeedbackTypes(): Promise<FeedbackTypesResponse> {
  const response = await api.get<FeedbackTypesResponse>("/api/v1/feedback/types");
  return response.data;
}

/**
 * Submit new feedback
 */
export async function submitFeedback(
  data: FeedbackCreateData
): Promise<FeedbackResponse> {
  const response = await api.post<FeedbackResponse>("/api/v1/feedback/", data);
  return response.data;
}

/**
 * List current user's feedback submissions
 */
export async function listMyFeedback(
  params?: FeedbackListParams
): Promise<FeedbackListResponse> {
  const response = await api.get<FeedbackListResponse>("/api/v1/feedback/my", {
    params,
  });
  return response.data;
}

/**
 * Get a specific feedback item by ID (current user's)
 */
export async function getMyFeedback(id: string): Promise<FeedbackResponse> {
  const response = await api.get<FeedbackResponse>(
    `/api/v1/feedback/my/${id}`
  );
  return response.data;
}

// Admin API functions

/**
 * List all feedback (admin only)
 */
export async function listAllFeedback(
  params?: FeedbackListParams
): Promise<FeedbackListResponse> {
  const response = await api.get<FeedbackListResponse>("/api/v1/feedback/", {
    params,
  });
  return response.data;
}

/**
 * Get feedback summary statistics (admin only)
 */
export async function getFeedbackSummary(): Promise<FeedbackSummary> {
  const response = await api.get<FeedbackSummary>("/api/v1/feedback/summary");
  return response.data;
}

/**
 * Get a specific feedback item (admin only)
 */
export async function getFeedback(id: string): Promise<FeedbackResponse> {
  const response = await api.get<FeedbackResponse>(`/api/v1/feedback/${id}`);
  return response.data;
}

/**
 * Update feedback (admin only)
 */
export async function updateFeedback(
  id: string,
  data: FeedbackUpdateData
): Promise<FeedbackResponse> {
  const response = await api.patch<FeedbackResponse>(
    `/api/v1/feedback/${id}`,
    data
  );
  return response.data;
}

/**
 * Assign feedback to a user (admin only)
 */
export async function assignFeedback(
  id: string,
  assignedTo: string
): Promise<FeedbackResponse> {
  const response = await api.post<FeedbackResponse>(
    `/api/v1/feedback/${id}/assign`,
    null,
    { params: { assigned_to: assignedTo } }
  );
  return response.data;
}
