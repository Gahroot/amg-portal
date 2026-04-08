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
import { createApiClient } from "./factory";

const reviewsApi = createApiClient<
  CapabilityReview,
  CapabilityReviewListResponse,
  CreateCapabilityReviewRequest,
  UpdateCapabilityReviewRequest
>("/api/v1/capability-reviews/", { updateMethod: "put" });

export const listCapabilityReviews = reviewsApi.list as (
  params?: CapabilityReviewListParams,
) => Promise<CapabilityReviewListResponse>;
export const getCapabilityReview = reviewsApi.get;
export const createCapabilityReview = reviewsApi.create;
export const updateCapabilityReview = reviewsApi.update;

// Custom endpoints

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
