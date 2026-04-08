/**
 * Communication types — re-exported from generated OpenAPI types where possible.
 *
 * API types are sourced from generated.ts (auto-generated from FastAPI OpenAPI schema).
 * Frontend-only types (WebSocket messages, UI constants, query params) remain manual.
 *
 * To refresh: npm run generate:types (requires backend at localhost:8000)
 *
 * @see backend/app/schemas/communication.py
 * @see backend/app/schemas/notification.py
 * @see backend/app/schemas/conversation.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type Communication = components["schemas"]["CommunicationResponse"];
export type CommunicationListResponse = components["schemas"]["CommunicationListResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, display types, WebSocket messages
// ---------------------------------------------------------------------------

export type CommunicationChannel = "email" | "in_portal" | "sms" | "whatsapp" | "phone" | "in_person" | "other";
export type CommunicationStatus = "draft" | "sending" | "sent" | "delivered" | "failed" | "read" | "archived";
export type CommunicationApprovalStatus = "draft" | "pending_review" | "approved" | "rejected" | "sent";
export type ReviewActionType = "approve" | "reject";
export type ConversationType = "rm_client" | "coordinator_partner" | "internal";
export type NotificationType = "communication" | "decision_pending" | "assignment_update" | "deliverable_ready" | "milestone_update" | "approval_required" | "system";
export type DecisionRequestStatus = "pending" | "responded" | "declined" | "expired" | "cancelled";
export type DigestFrequency = "immediate" | "hourly" | "daily" | "weekly" | "never";
export type TemplateType = "welcome" | "program_kickoff" | "weekly_status" | "decision_request" | "milestone_alert" | "completion_note" | "partner_dispatch" | "deliverable_submission" | "custom";
export type TemplateStatus = "draft" | "pending" | "approved" | "rejected";
export type DecisionResponseType = "choice" | "text" | "yes_no" | "multi_choice";

// Conversation types
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

export interface ConversationCreateData {
  conversation_type: ConversationType;
  client_id?: string;
  partner_assignment_id?: string;
  title?: string;
  participant_ids: string[];
}

export interface ConversationUpdateData {
  title?: string;
  participant_ids?: string[];
}

// Communication send types
export interface Recipient {
  user_id: string;
  role: string;
  email?: string;
  name?: string;
}

export interface SendMessageData {
  conversation_id?: string;
  body: string;
  attachment_ids?: string[];
}

export interface UnreadCountResponse {
  total: number;
  by_conversation: Record<string, number>;
}

// Notification types
export interface Notification {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  action_url?: string;
  action_label?: string;
  entity_type?: string;
  entity_id?: string;
  priority: string;
  is_read: boolean;
  read_at?: string;
  email_delivered: boolean;
  group_key?: string;
  snoozed_until?: string;
  snooze_count: number;
  created_at: string;
}

export type SnoozeDurationPreset = 60 | 240 | 1440 | 1441 | 10080;

export interface SnoozeRequestData {
  snooze_duration_minutes?: SnoozeDurationPreset;
  snooze_until?: string;
}

export const SNOOZE_PRESETS: { value: SnoozeDurationPreset; label: string }[] = [
  { value: 60, label: "1 hour" },
  { value: 240, label: "4 hours" },
  { value: 1440, label: "Tomorrow morning (9 AM)" },
  { value: 1441, label: "Tomorrow afternoon (2 PM)" },
  { value: 10080, label: "Next week (Monday 9 AM)" },
];

export interface NotificationGroup {
  group_key: string;
  group_label: string;
  notification_type: NotificationType;
  entity_type?: string;
  entity_id?: string;
  priority: string;
  count: number;
  unread_count: number;
  is_read: boolean;
  latest_created_at: string;
  latest_title: string;
  latest_body: string;
  action_url?: string;
  action_label?: string;
  notifications: Notification[];
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  groups?: NotificationGroup[];
  group_mode?: "type" | "entity" | "time" | null;
}

export interface GroupedNotificationsResponse {
  groups: NotificationGroup[];
  total_groups: number;
  total_notifications: number;
  group_mode: "type" | "entity" | "time";
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  digest_enabled: boolean;
  digest_frequency: DigestFrequency;
  notification_type_preferences?: Record<string, string>;
  channel_preferences?: Record<string, boolean>;
  grouping_mode?: "type" | "entity" | "time" | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferenceUpdateData {
  digest_enabled?: boolean;
  digest_frequency?: DigestFrequency;
  notification_type_preferences?: Record<string, string>;
  channel_preferences?: Record<string, boolean>;
  grouping_mode?: "type" | "entity" | "time" | null;
}

// Decision Request types
export interface DecisionOption {
  id: string;
  label: string;
  description?: string;
  impact_description?: string;
  what_happens_next?: string;
  considerations?: string[];
  recommended?: boolean;
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

export interface DecisionCreateData {
  client_id: string;
  program_id?: string;
  title: string;
  prompt: string;
  response_type: DecisionResponseType;
  options?: DecisionOption[];
  deadline_date?: string;
  deadline_time?: string;
  consequence_text?: string;
}

export interface DecisionResponseData {
  option_id?: string;
  text?: string;
}

// Template types
export interface VariableDefinition {
  type: string;
  description: string;
  default?: string;
  required: boolean;
}

export interface CommunicationTemplate {
  id: string;
  name: string;
  template_type: TemplateType;
  subject?: string;
  body: string;
  variable_definitions?: Record<string, VariableDefinition>;
  is_active: boolean;
  is_system: boolean;
  status: TemplateStatus;
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateStatusActionData {
  action: "submit" | "approve" | "reject";
  reason?: string;
}

export interface TemplateListResponse {
  templates: CommunicationTemplate[];
  total: number;
}

export interface TemplateCreateData {
  name: string;
  template_type: TemplateType;
  subject?: string;
  body: string;
  variable_definitions?: Record<string, VariableDefinition>;
}

export interface TemplateRenderRequest {
  template_id: string;
  variables: Record<string, unknown>;
}

export interface TemplateRenderResponse {
  subject?: string;
  body: string;
}

export interface TemplatePreviewRequest {
  template_id: string;
  variables: Record<string, string>;
}

export interface TemplatePreviewResponse {
  subject?: string;
  body: string;
}

export interface SendFromTemplateRequest {
  template_id: string;
  recipient_user_ids: string[];
  variables: Record<string, string>;
  client_id?: string;
  program_id?: string;
  partner_id?: string;
}

// Approval workflow types
export interface ReviewAction {
  action: ReviewActionType;
  notes?: string;
}

export interface PendingReviewsResponse {
  communications: Communication[];
  total: number;
}

// Message Digest types
export interface MessageDigestPreference {
  user_id: string;
  digest_frequency: DigestFrequency;
  last_digest_sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MessageDigestPreferenceUpdate {
  digest_frequency: DigestFrequency;
}

export interface DigestMessageSummary {
  message_id: string;
  conversation_id: string;
  conversation_title?: string;
  sender_name?: string;
  body_preview: string;
  sent_at: string;
}

export interface DigestPreviewResponse {
  user_id: string;
  unread_count: number;
  messages: DigestMessageSummary[];
  period_start?: string;
  period_end: string;
}

// WebSocket message types (frontend-only)
export interface WSMessage {
  type: string;
  data?: unknown;
}

export interface WSNotificationMessage extends WSMessage {
  type: "notification";
  data: Notification;
}

export interface WSTypingMessage extends WSMessage {
  type: "typing";
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
}

export interface WSNewMessageMessage extends WSMessage {
  type: "new_message";
  data: Communication;
}

export interface WSEscalationData {
  id: string;
  level: string;
  status: string;
  title: string;
  entity_type: string;
  entity_id: string;
  program_id?: string;
}

export interface WSEscalationMessage extends WSMessage {
  type: "escalation";
  action: "created" | "updated";
  data: WSEscalationData;
}

export interface WSProgramUpdateData {
  id: string;
  title: string;
  status: string;
  previous_status: string;
}

export interface WSProgramUpdateMessage extends WSMessage {
  type: "program_update";
  data: WSProgramUpdateData;
}
