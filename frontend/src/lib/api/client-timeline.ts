import api from "@/lib/api";
import type { TimelineListResponse } from "@/types/client-timeline";

export async function getClientTimeline(
  profileId: string,
  params?: {
    event_types?: string;
    date_from?: string;
    date_to?: string;
    skip?: number;
    limit?: number;
  }
): Promise<TimelineListResponse> {
  const { data } = await api.get<TimelineListResponse>(
    `/api/v1/clients/${profileId}/timeline`,
    { params }
  );
  return data;
}
