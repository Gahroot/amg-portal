export type TimelineEventType =
  | "communication"
  | "document"
  | "milestone"
  | "program_status"
  | "approval"
  | "compliance"
  | "note";

export interface TimelineEvent {
  id: string;
  event_type: TimelineEventType;
  title: string;
  description: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
  entity_id: string | null;
  entity_type: string | null;
  actor_name: string | null;
  actor_id: string | null;
}

export interface TimelineListResponse {
  items: TimelineEvent[];
  total: number;
  has_more: boolean;
}

export interface TimelineFilters {
  event_types?: TimelineEventType[];
  date_from?: string;
  date_to?: string;
}
