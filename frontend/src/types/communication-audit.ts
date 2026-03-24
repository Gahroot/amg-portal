export type CommunicationAuditAction =
  | "created"
  | "sent"
  | "viewed"
  | "replied"
  | "forwarded"
  | "archived"
  | "deleted"
  | "status_changed";

export type PreferredChannel = "email" | "phone" | "portal" | "sms";

export interface CommunicationAuditRecord {
  id: string;
  communication_id: string | null;
  conversation_id: string | null;
  action: CommunicationAuditAction;
  actor_id: string;
  actor_name: string | null;
  actor_email: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface CommunicationAuditListResponse {
  audits: CommunicationAuditRecord[];
  total: number;
}

export interface CommunicationAuditSearchParams {
  action?: CommunicationAuditAction;
  actor_id?: string;
  communication_id?: string;
  conversation_id?: string;
  start_date?: string;
  end_date?: string;
  skip?: number;
  limit?: number;
}

export interface CommunicationPreferences {
  preferred_channels: PreferredChannel[] | null;
  contact_hours_start: string | null;
  contact_hours_end: string | null;
  contact_timezone: string | null;
  language_preference: string | null;
  do_not_contact: boolean;
  opt_out_marketing: boolean;
  communication_preference: string | null;
  special_instructions: string | null;
}

export interface CommunicationPreferencesUpdate {
  preferred_channels?: PreferredChannel[] | null;
  contact_hours_start?: string | null;
  contact_hours_end?: string | null;
  contact_timezone?: string | null;
  language_preference?: string | null;
  do_not_contact?: boolean;
  opt_out_marketing?: boolean;
  communication_preference?: string | null;
  special_instructions?: string | null;
}

export interface ChannelCheckResponse {
  allowed: boolean;
  reason: string | null;
}
