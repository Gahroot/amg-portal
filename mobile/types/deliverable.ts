export type DeliverableStatus = 'pending' | 'submitted' | 'under_review' | 'approved' | 'returned' | 'rejected';
export type DeliverableType = 'report' | 'document' | 'presentation' | 'spreadsheet' | 'other';

export interface Deliverable {
  id: string;
  assignment_id: string;
  title: string;
  deliverable_type: DeliverableType;
  description: string | null;
  due_date: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  submitted_at: string | null;
  submitted_by: string | null;
  status: DeliverableStatus;
  review_comments: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  client_visible: boolean;
  created_at: string;
  updated_at: string;
  download_url: string | null;
}

export interface DeliverableListResponse {
  deliverables: Deliverable[];
  total: number;
}

export interface DeliverableReviewData {
  status: 'approved' | 'returned' | 'rejected';
  review_comments?: string;
}
