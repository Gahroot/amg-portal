import api from "@/lib/api";
import type {
  CapabilityReview,
  CapabilityReviewListResponse,
  CapabilityReviewStatistics,
  CreateCapabilityReviewRequest,
  UpdateCapabilityReviewRequest,
  CompleteCapabilityReviewRequest,
  GenerateAnnualReviewsRequest,
  CapabilityReviewListParams,
} from "@/types/capability-review";

export async function listCapabilityReviews(
  params?: CapabilityReviewListParams
): Promise<CapabilityReviewListResponse> {
  const response = await api.get<CapabilityReviewListResponse>(
    "/api/v1/capability-reviews/",
    { params }
  );
  return response.data;
}

export async function getCapabilityReview(id: string): Promise<CapabilityReview> {
  const response = await api.get<CapabilityReview>(
    `/api/v1/capability-reviews/${id}`
  );
  return response.data;
}

export async function createCapabilityReview(
  data: CreateCapabilityReviewRequest
): Promise<CapabilityReview> {
  const response = await api.post<CapabilityReview>(
    "/api/v1/capability-reviews/",
    data
  );
  return response.data;
}

export async function updateCapabilityReview(
  id: string,
  data: UpdateCapabilityReviewRequest
): Promise<CapabilityReview> {
  const response = await api.put<CapabilityReview>(
    `/api/v1/capability-reviews/${id}`,
    data
  );
  return response.data;
}

export async function completeCapabilityReview(
  id: string,
  data: CompleteCapabilityReviewRequest
): Promise<CapabilityReview> {
  const response = await api.post<CapabilityReview>(
    `/api/v1/capability-reviews/${id}/complete`,
    data
  );
  return response.data;
}

export async function getCapabilityReviewStatistics(): Promise<CapabilityReviewStatistics> {
  const response = await api.get<CapabilityReviewStatistics>(
    "/api/v1/capability-reviews/statistics"
  );
  return response.data;
}

export async function getPendingReviews(
  params?: { skip?: number; limit?: number }
): Promise<CapabilityReviewListResponse> {
  const response = await api.get<CapabilityReviewListResponse>(
    "/api/v1/capability-reviews/pending",
    { params }
  );
  return response.data;
}

export async function getOverdueReviews(): Promise<CapabilityReviewListResponse> {
  const response = await api.get<CapabilityReviewListResponse>(
    "/api/v1/capability-reviews/overdue"
  );
  return response.data;
}

export async function generateAnnualReviews(
  data: GenerateAnnualReviewsRequest
): Promise<CapabilityReviewListResponse> {
  const response = await api.post<CapabilityReviewListResponse>(
    "/api/v1/capability-reviews/generate-annual",
    data
  );
  return response.data;
}
