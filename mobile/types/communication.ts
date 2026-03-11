export type CommunicationChannel = 'email' | 'in_portal' | 'sms' | 'whatsapp' | 'phone' | 'in_person' | 'other';
export type CommunicationStatus = 'draft' | 'sending' | 'sent' | 'delivered' | 'failed' | 'read' | 'archived';
export type ConversationType = 'rm_client' | 'coordinator_partner' | 'internal';

export interface ParticipantInfo {
  id: string;
  full_name: string;
  role: string;
}

export interface Conversation {
  id: string;
  conversation_type: ConversationType;
  client_id?: string;
  partner_assignment_id?: string;
  title?: string;
  participant_ids: string[];
  last_activity_at?: string;
  created_at: string;
  updated_at: string;
  unread_count: number;
  participants: ParticipantInfo[];
}

export interface ConversationListResponse {
  conversations: Conversation[];
  total: number;
}

export interface Communication {
  id: string;
  conversation_id?: string;
  channel: CommunicationChannel;
  status: CommunicationStatus;
  sender_id?: string;
  sender_name?: string;
  recipients?: Record<string, unknown>;
  subject?: string;
  body: string;
  attachment_ids?: string[];
  client_id?: string;
  program_id?: string;
  partner_id?: string;
  read_receipts?: Record<string, { read_at: string }>;
  sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CommunicationListResponse {
  communications: Communication[];
  total: number;
}

export interface SendMessageData {
  conversation_id?: string;
  body: string;
  attachment_ids?: string[];
}
