import api from "@/lib/api";
import type {
  Communication,
  CommunicationListResponse,
  ReviewAction,
} from "@/types/communication";

export async function submitForReview(id: string): Promise<Communication> {
  const response = await api.post<Communication>(
    `/api/v1/communications/${id}/submit-review`
  );
  return response.data;
}

export async function reviewCommunication(
  id: string,
  data: ReviewAction
): Promise<Communication> {
  const response = await api.post<Communication>(
    `/api/v1/communications/${id}/review`,
    data
  );
  return response.data;
}

export async function getPendingReviews(params?: {
  skip?: number;
  limit?: number;
}): Promise<CommunicationListResponse> {
  const response = await api.get<CommunicationListResponse>(
    "/api/v1/communications/pending-reviews",
    { params }
  );
  return response.data;
}

export async function getCommunicationsByStatus(
  status: string,
  params?: { skip?: number; limit?: number }
): Promise<CommunicationListResponse> {
  const response = await api.get<CommunicationListResponse>(
    `/api/v1/communications/by-status/${status}`,
    { params }
  );
  return response.data;
}
