export type DecisionRequestStatus = 'pending' | 'responded' | 'declined' | 'expired' | 'cancelled';
export type DecisionResponseType = 'choice' | 'text' | 'yes_no' | 'multi_choice';

export interface DecisionOption {
  id: string;
  label: string;
  description?: string;
}

export interface DecisionRequest {
  id: string;
  client_id: string;
  program_id?: string;
  title: string;
  prompt: string;
  response_type: DecisionResponseType;
  options?: DecisionOption[];
  deadline_date?: string;
  deadline_time?: string;
  consequence_text?: string;
  status: DecisionRequestStatus;
  response?: {
    option_id?: string;
    text?: string;
    responded_at?: string;
  };
  responded_at?: string;
  responded_by?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DecisionListResponse {
  decisions: DecisionRequest[];
  total: number;
}

export interface DecisionResponseData {
  option_id?: string;
  text?: string;
}
