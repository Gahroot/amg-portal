export interface DeliverableItem {
  id: string;
  assignment_id: string;
  title: string;
  deliverable_type: string;
  description: string | null;
  due_date: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  submitted_at: string | null;
  submitted_by: string | null;
  status: string;
  review_comments: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  client_visible: boolean;
  created_at: string;
  updated_at: string;
  download_url: string | null;
}

export interface DeliverableListResponse {
  deliverables: DeliverableItem[];
  total: number;
}

export interface DeliverableListParams {
  skip?: number;
  limit?: number;
  assignment_id?: string;
  status?: string;
  search?: string;
}

export interface DeliverableCreateData {
  assignment_id: string;
  title: string;
  deliverable_type?: string;
  description?: string;
  due_date?: string;
}

export interface DeliverableUpdateData {
  title?: string;
  description?: string;
  due_date?: string;
  client_visible?: boolean;
}

export interface DeliverableReviewData {
  status: "approved" | "returned" | "rejected";
  review_comments?: string;
}
