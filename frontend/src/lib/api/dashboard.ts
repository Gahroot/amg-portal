import api from "@/lib/api";

// ============================================================================
// Types
// ============================================================================

export interface ProgramHealthItem {
  id: string;
  title: string;
  status: string;
  client_name: string;
  rag_status: "red" | "amber" | "green";
  milestone_count: number;
  completed_milestone_count: number;
  milestone_progress: number;
  active_escalation_count: number;
  sla_breach_count: number;
}

export interface ProgramHealthResponse {
  programs: ProgramHealthItem[];
  total: number;
}

export interface PortfolioSummary {
  total_programs: number;
  active_programs: number;
  completed_programs: number;
  total_clients: number;
  rag_breakdown: Record<string, number>;
  total_open_escalations: number;
  total_sla_breaches: number;
  total_pending_decisions: number;
  /** Count of active partners still in probationary period (< 3 completed engagements). */
  probationary_partner_count: number;
}

export interface PartnerScorecard {
  partner_id: string;
  firm_name: string;
  avg_quality: number | null;
  avg_timeliness: number | null;
  avg_communication: number | null;
  avg_overall: number | null;
  total_ratings: number;
  total_assignments: number;
  completed_assignments: number;
  active_assignments: number;
}

export interface PartnerRanking {
  partner_id: string;
  firm_name: string;
  avg_overall: number | null;
  total_ratings: number;
  total_assignments: number;
}

export interface PartnerRankingsResponse {
  rankings: PartnerRanking[];
  total: number;
}

export interface PartnerPerformanceEntry {
  rating_id: string;
  program_id: string;
  quality_score: number;
  timeliness_score: number;
  communication_score: number;
  overall_score: number;
  comments: string | null;
  created_at: string;
}

// ============================================================================
// Dashboard API
// ============================================================================

export async function getProgramHealth(): Promise<ProgramHealthResponse> {
  const response = await api.get<ProgramHealthResponse>(
    "/api/v1/dashboard/program-health",
  );
  return response.data;
}

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const response = await api.get<PortfolioSummary>(
    "/api/v1/dashboard/portfolio-summary",
  );
  return response.data;
}

// ============================================================================
// Real-Time Dashboard API
// ============================================================================

export interface RealTimeStats {
  active_programs: number;
  pending_approvals: number;
  open_escalations: number;
  sla_breaches: number;
  unread_notifications: number;
  upcoming_deadlines: number;
}

export interface ActivityFeedItem {
  id: string;
  activity_type: string;
  title: string;
  description: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
  actor_name: string | null;
  link: string | null;
}

export interface ActivityFeedResponse {
  items: ActivityFeedItem[];
  total: number;
}

export interface DashboardAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  alert_type: string;
  title: string;
  description: string;
  entity_type: string;
  entity_id: string;
  link: string | null;
  due_date: string | null;
}

export interface AlertsResponse {
  alerts: DashboardAlert[];
  total: number;
}

export async function getRealTimeStats(): Promise<RealTimeStats> {
  const response = await api.get<RealTimeStats>(
    "/api/v1/dashboard/real-time-stats",
  );
  return response.data;
}

export async function getActivityFeed(
  skip = 0,
  limit = 50,
): Promise<ActivityFeedResponse> {
  const response = await api.get<ActivityFeedResponse>(
    "/api/v1/dashboard/activity-feed",
    { params: { skip, limit } },
  );
  return response.data;
}

export async function getDashboardAlerts(): Promise<AlertsResponse> {
  const response = await api.get<AlertsResponse>(
    "/api/v1/dashboard/alerts",
  );
  return response.data;
}

// ============================================================================
// Partner Scoring API
// ============================================================================

export async function getPartnerScorecard(
  partnerId: string,
): Promise<PartnerScorecard> {
  const response = await api.get<PartnerScorecard>(
    `/api/v1/partner-scoring/${partnerId}/scorecard`,
  );
  return response.data;
}

export async function getPartnerRankings(
  skip = 0,
  limit = 50,
): Promise<PartnerRankingsResponse> {
  const response = await api.get<PartnerRankingsResponse>(
    "/api/v1/partner-scoring/rankings",
    { params: { skip, limit } },
  );
  return response.data;
}

export async function getPartnerPerformanceHistory(
  partnerId: string,
): Promise<PartnerPerformanceEntry[]> {
  const response = await api.get<PartnerPerformanceEntry[]>(
    `/api/v1/partner-scoring/${partnerId}/performance-history`,
  );
  return response.data;
}
