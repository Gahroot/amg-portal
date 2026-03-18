export type CommunicationLogChannel = "email" | "phone" | "video_call" | "in_person" | "letter";
export type CommunicationLogDirection = "inbound" | "outbound";

export interface CommunicationLog {
  id: string;
  channel: CommunicationLogChannel;
  direction: CommunicationLogDirection;
  subject: string;
  summary: string | null;
  client_id: string | null;
  partner_id: string | null;
  program_id: string | null;
  logged_by: string;
  contact_name: string | null;
  contact_email: string | null;
  occurred_at: string;
  attachments: Record<string, unknown> | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  client_name: string | null;
  partner_name: string | null;
  program_title: string | null;
  logger_name: string | null;
}

export interface CommunicationLogListResponse {
  logs: CommunicationLog[];
  total: number;
}

export interface CommunicationLogCreateData {
  channel: CommunicationLogChannel;
  direction: CommunicationLogDirection;
  subject: string;
  summary?: string;
  client_id?: string;
  partner_id?: string;
  program_id?: string;
  contact_name?: string;
  contact_email?: string;
  occurred_at: string;
  attachments?: Record<string, unknown>;
  tags?: string[];
}

export type CommunicationLogUpdateData = Partial<CommunicationLogCreateData>;

export interface CommunicationLogListParams {
  client_id?: string;
  partner_id?: string;
  program_id?: string;
  channel?: string;
  direction?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  skip?: number;
  limit?: number;
}
