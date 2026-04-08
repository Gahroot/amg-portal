/**
 * Centralized query key factory for TanStack Query.
 *
 * Every key is a readonly tuple so invalidation by prefix works correctly:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.clients.all })
 * invalidates all client queries (lists, details, sub-resources).
 *
 * Pattern per entity:
 *   all       → base prefix — invalidates everything for this entity
 *   lists()   → narrows to list queries
 *   list(p)   → specific list with params
 *   details() → narrows to detail queries
 *   detail(id)→ one record
 */

// Helper to build a consistent entity key set
function createEntityKeys<T extends string>(entity: T) {
  return {
    all: [entity] as const,
    lists: () => [entity, "list"] as const,
    list: (params?: unknown) => [entity, "list", params] as const,
    details: () => [entity, "detail"] as const,
    detail: (id: string) => [entity, "detail", id] as const,
  };
}

export const queryKeys = {
  // ── Clients ────────────────────────────────────────────────────────────────
  clients: {
    ...createEntityKeys("clients"),
    profiles: (params?: unknown) => ["clients", "profiles", params] as const,
    profile: (id: string) => ["clients", "profile", id] as const,
    portfolio: (params?: unknown) => ["clients", "portfolio", params] as const,
    certificate: (id: string) => ["clients", "detail", id, "certificate"] as const,
    securityBrief: (id: string) => ["clients", "detail", id, "security-brief"] as const,
    upcomingDates: (daysAhead?: number) => ["clients", "upcoming-dates", daysAhead] as const,
    compare: (ids: string[]) => ["clients", "compare", ids] as const,
    timeline: (profileId: string | undefined, filters?: unknown) =>
      ["clients", "timeline", profileId, filters] as const,
  },

  // ── Partners ───────────────────────────────────────────────────────────────
  partners: createEntityKeys("partners"),

  // ── Programs ───────────────────────────────────────────────────────────────
  programs: {
    ...createEntityKeys("programs"),
    summary: (id: string) => ["programs", "detail", id, "summary"] as const,
    compare: (ids: string[]) => ["programs", "compare", ids] as const,
  },

  // ── Tasks ──────────────────────────────────────────────────────────────────
  tasks: {
    ...createEntityKeys("tasks"),
    programs: () => ["tasks", "programs"] as const,
    assignees: () => ["tasks", "assignees"] as const,
    milestones: (programId: string | null) => ["tasks", "milestones", programId] as const,
  },

  // ── Approvals ──────────────────────────────────────────────────────────────
  approvals: {
    ...createEntityKeys("approvals"),
    program: (programId: string) => ["approvals", "program", programId] as const,
  },

  // ── Documents ──────────────────────────────────────────────────────────────
  documents: {
    all: ["documents"] as const,
    entity: (entityType: string, entityId: string) =>
      ["documents", entityType, entityId] as const,
    versions: (documentId: string) => ["documents", "versions", documentId] as const,
    vault: (vaultStatus?: string) => ["documents", "vault", vaultStatus] as const,
    custodyChain: (documentId: string) => ["documents", "custody-chain", documentId] as const,
    deliveries: (documentId: string) => ["documents", "deliveries", documentId] as const,
    expiring: (params?: unknown) => ["documents", "expiring", params] as const,
    compare: (versionAId: string | null, versionBId: string | null) =>
      ["documents", "compare", versionAId, versionBId] as const,
  },

  // ── Document Requests ──────────────────────────────────────────────────────
  documentRequests: {
    all: ["document-requests"] as const,
    list: (clientId?: string, status?: string) =>
      ["document-requests", clientId, status] as const,
  },

  // ── Notifications ──────────────────────────────────────────────────────────
  notifications: {
    all: ["notifications"] as const,
    list: (params?: unknown) => ["notifications", "list", params] as const,
    grouped: (params?: unknown) => ["notifications", "grouped", params] as const,
    unreadCount: () => ["notifications", "unread-count"] as const,
    snoozed: (params?: unknown) => ["notifications", "snoozed", params] as const,
    preferences: () => ["notification-preferences"] as const,
  },

  // ── Users ──────────────────────────────────────────────────────────────────
  users: {
    ...createEntityKeys("users"),
    current: () => ["user"] as const,
  },

  // ── Escalations ────────────────────────────────────────────────────────────
  escalations: {
    ...createEntityKeys("escalations"),
    entity: (entityType: string, entityId: string) =>
      ["escalations", "entity", entityType, entityId] as const,
    simpleMetrics: () => ["escalations", "simple-metrics"] as const,
    overdue: (params?: unknown) => ["escalations", "overdue", params] as const,
  },

  // ── Deliverables ───────────────────────────────────────────────────────────
  deliverables: createEntityKeys("deliverables"),

  // ── Conversations & Messages ───────────────────────────────────────────────
  conversations: {
    all: ["conversations"] as const,
    list: (params?: unknown) => ["conversations", "list", params] as const,
    detail: (id: string) => ["conversations", "detail", id] as const,
    messages: (conversationId: string, params?: unknown) =>
      ["conversations", "messages", conversationId, params] as const,
    messagesAll: (conversationId: string) =>
      ["conversations", "messages", conversationId] as const,
    unreadCount: () => ["conversations", "unread-count"] as const,
  },

  // ── Decisions ──────────────────────────────────────────────────────────────
  decisions: {
    all: ["decisions"] as const,
    list: (params?: unknown) => ["decisions", "list", params] as const,
    detail: (id: string) => ["decisions", "detail", id] as const,
    pending: (params?: unknown) => ["decisions", "pending", params] as const,
  },

  // ── Certificates ───────────────────────────────────────────────────────────
  certificates: {
    all: ["certificates"] as const,
    list: (params?: unknown) => ["certificates", "list", params] as const,
    detail: (id: string) => ["certificates", "detail", id] as const,
    templates: {
      all: ["certificates", "templates"] as const,
      list: (params?: unknown) => ["certificates", "templates", "list", params] as const,
      detail: (id: string) => ["certificates", "templates", "detail", id] as const,
    },
  },

  // ── Templates (communication) ──────────────────────────────────────────────
  templates: {
    all: ["templates"] as const,
    byType: (templateType?: string) => ["templates", "byType", templateType] as const,
    allIncludingInactive: (templateType?: string) =>
      ["templates", "all-inclusive", templateType] as const,
  },

  // ── Invoices ───────────────────────────────────────────────────────────────
  invoices: {
    all: ["invoices"] as const,
    list: (params?: unknown) => ["invoices", "list", params] as const,
  },

  // ── SLA ────────────────────────────────────────────────────────────────────
  sla: {
    all: ["sla"] as const,
    list: (params?: unknown) => ["sla", "list", params] as const,
    breaches: (includeApproaching?: boolean) =>
      ["sla", "breaches", includeApproaching] as const,
    entity: (entityType: string, entityId: string, params?: unknown) =>
      ["sla", "entity", entityType, entityId, params] as const,
  },

  // ── NPS Surveys ────────────────────────────────────────────────────────────
  npsSurveys: {
    all: ["nps-surveys"] as const,
    list: (params?: unknown) => ["nps-surveys", "list", params] as const,
    detail: (id: string) => ["nps-surveys", "detail", id] as const,
    active: () => ["nps-surveys", "active"] as const,
    stats: (id: string) => ["nps-surveys", "detail", id, "stats"] as const,
    trends: (params?: unknown) => ["nps-surveys", "trends", params] as const,
    responses: (surveyId: string, params?: unknown) =>
      ["nps-surveys", "detail", surveyId, "responses", params] as const,
    response: (surveyId: string, responseId: string) =>
      ["nps-surveys", "detail", surveyId, "responses", responseId] as const,
    responsesAll: (surveyId: string) =>
      ["nps-surveys", "detail", surveyId, "responses"] as const,
    followUps: {
      bySurvey: (surveyId: string, params?: unknown) =>
        ["nps-surveys", "detail", surveyId, "follow-ups", params] as const,
      my: (params?: unknown) => ["nps-surveys", "follow-ups", "my", params] as const,
      detail: (followUpId: string) =>
        ["nps-surveys", "follow-ups", followUpId] as const,
    },
  },

  // ── Partner Portal ─────────────────────────────────────────────────────────
  partnerPortal: {
    all: ["partner-portal"] as const,
    profile: () => ["partner-portal", "profile"] as const,
    assignments: {
      all: ["partner-portal", "assignments"] as const,
      list: (params?: unknown) => ["partner-portal", "assignments", "list", params] as const,
      detail: (id: string) => ["partner-portal", "assignments", "detail", id] as const,
      documents: (assignmentId: string) =>
        ["partner-portal", "assignments", "detail", assignmentId, "documents"] as const,
    },
    deliverables: {
      all: ["partner-portal", "deliverables"] as const,
      list: (params?: unknown) => ["partner-portal", "deliverables", "list", params] as const,
      detail: (id: string) => ["partner-portal", "deliverables", "detail", id] as const,
    },
    conversations: {
      all: ["partner-portal", "conversations"] as const,
      list: (params?: unknown) => ["partner-portal", "conversations", "list", params] as const,
      detail: (conversationId: string) =>
        ["partner-portal", "conversations", "detail", conversationId] as const,
      messages: (conversationId: string, params?: unknown) =>
        ["partner-portal", "conversations", "detail", conversationId, "messages", params] as const,
      messagesAll: (conversationId: string) =>
        ["partner-portal", "conversations", "detail", conversationId, "messages"] as const,
    },
    reports: {
      briefSummary: () => ["partner-portal", "reports", "brief-summary"] as const,
      deliverableFeedback: (assignmentId?: string) =>
        ["partner-portal", "reports", "deliverable-feedback", assignmentId] as const,
      engagementHistory: () => ["partner-portal", "reports", "engagement-history"] as const,
    },
    performanceNotices: () => ["partner-portal", "performance-notices"] as const,
    capabilityRefresh: {
      all: ["partner-portal", "capability-refresh"] as const,
      status: () => ["partner-portal", "capability-refresh", "status"] as const,
    },
    scorecard: (period: string) => ["partner-portal", "scorecard", period] as const,
    onboarding: (partnerId?: string) => ["partner-portal", "onboarding", partnerId] as const,
    performanceStatus: () => ["partner-portal", "performance-status"] as const,
    payments: {
      all: ["partner-portal", "payments"] as const,
      list: (params?: unknown) => ["partner-portal", "payments", "list", params] as const,
      summary: () => ["partner-portal", "payments", "summary"] as const,
    },
  },

  // ── Budget Approvals ───────────────────────────────────────────────────────
  budgetApprovals: {
    all: ["budget-approvals"] as const,
    requests: {
      all: ["budget-approvals", "requests"] as const,
      list: (params?: unknown) => ["budget-approvals", "requests", "list", params] as const,
      detail: (id: string) => ["budget-approvals", "requests", "detail", id] as const,
    },
    pending: () => ["budget-approvals", "pending"] as const,
    history: (requestId: string) => ["budget-approvals", "history", requestId] as const,
    thresholds: {
      all: ["budget-approvals", "thresholds"] as const,
      list: (isActive?: boolean) =>
        ["budget-approvals", "thresholds", "list", { isActive }] as const,
    },
    chains: {
      all: ["budget-approvals", "chains"] as const,
      list: (isActive?: boolean) =>
        ["budget-approvals", "chains", "list", { isActive }] as const,
      detail: (id: string) => ["budget-approvals", "chains", "detail", id] as const,
    },
  },

  // ── Capability Reviews ─────────────────────────────────────────────────────
  capabilityReviews: {
    all: ["capability-reviews"] as const,
    list: (params?: unknown) => ["capability-reviews", "list", params] as const,
    detail: (id: string) => ["capability-reviews", "detail", id] as const,
    statistics: () => ["capability-reviews", "statistics"] as const,
    pending: (params?: unknown) => ["capability-reviews", "pending", params] as const,
    overdue: () => ["capability-reviews", "overdue"] as const,
  },

  // ── Communication Logs ─────────────────────────────────────────────────────
  communicationLogs: {
    all: ["communication-logs"] as const,
    list: (params?: unknown) => ["communication-logs", "list", params] as const,
    detail: (id: string) => ["communication-logs", "detail", id] as const,
  },

  // ── Communication Approvals ────────────────────────────────────────────────
  communications: {
    all: ["communications"] as const,
    pendingReviews: (params?: unknown) =>
      ["communications", "pending-reviews", params] as const,
    byStatus: (status: string, params?: unknown) =>
      ["communications", "by-status", status, params] as const,
  },

  // ── Communication Audit ────────────────────────────────────────────────────
  communicationAudit: {
    all: ["communication-audit"] as const,
    trail: (communicationId: string, params?: unknown) =>
      ["communication-audit", communicationId, params] as const,
    search: (params?: unknown) => ["communication-audit", "search", params] as const,
    clientPreferences: (clientId: string) =>
      ["communication-audit", "client-preferences", clientId] as const,
    channelCheck: (clientId: string, channel: string) =>
      ["communication-audit", "channel-check", clientId, channel] as const,
  },

  // ── Closure ────────────────────────────────────────────────────────────────
  closure: {
    all: ["closure"] as const,
    detail: (programId: string) => ["closure", programId] as const,
    ratings: (programId: string) => ["closure", programId, "ratings"] as const,
  },

  // ── KYC Documents ──────────────────────────────────────────────────────────
  kycDocuments: {
    all: ["kyc-documents"] as const,
    byClient: (clientId: string) => ["kyc-documents", clientId] as const,
    expiring: (days?: number) => ["kyc-documents", "expiring", days] as const,
  },

  // ── Deletion Requests ──────────────────────────────────────────────────────
  deletionRequests: {
    all: ["deletion-requests"] as const,
    list: (params?: unknown) => ["deletion-requests", "list", params] as const,
    detail: (id: string) => ["deletion-requests", "detail", id] as const,
  },

  // ── Access Audits ──────────────────────────────────────────────────────────
  accessAudits: {
    all: ["access-audits"] as const,
    list: (params?: unknown) => ["access-audits", "list", params] as const,
    detail: (id: string) => ["access-audits", "detail", id] as const,
    statistics: () => ["access-audits", "statistics"] as const,
    current: () => ["access-audits", "current"] as const,
    findings: (params?: unknown) => ["access-audits", "findings", params] as const,
  },

  // ── Pulse Surveys ──────────────────────────────────────────────────────────
  pulseSurveys: {
    all: ["pulse-surveys"] as const,
    list: (params?: unknown) => ["pulse-surveys", "list", params] as const,
    detail: (id: string) => ["pulse-surveys", "detail", id] as const,
    stats: (id: string) => ["pulse-surveys", "detail", id, "stats"] as const,
    responses: (id: string, params?: unknown) =>
      ["pulse-surveys", "detail", id, "responses", params] as const,
    activeForMe: () => ["pulse-surveys", "active-for-me"] as const,
    myStatus: (surveyId: string) => ["pulse-surveys", "detail", surveyId, "my-status"] as const,
  },

  // ── Scheduling ─────────────────────────────────────────────────────────────
  scheduling: {
    all: ["scheduled-events"] as const,
    list: (params?: unknown) => ["scheduled-events", "list", params] as const,
    detail: (id: string) => ["scheduled-events", "detail", id] as const,
    mySchedule: (start: string, end: string) =>
      ["scheduled-events", "my-schedule", start, end] as const,
    conflicts: (start: string, end: string) =>
      ["scheduled-events", "conflicts", start, end] as const,
  },

  // ── Meetings ───────────────────────────────────────────────────────────────
  meetings: {
    all: ["meetings"] as const,
    types: () => ["meetings", "types"] as const,
    myList: (params?: unknown) => ["meetings", "my", params] as const,
    rmList: (params?: unknown) => ["meetings", "rm", params] as const,
    slots: (params: unknown) => ["meetings", "slots", params] as const,
  },

  // ── Dashboard ──────────────────────────────────────────────────────────────
  dashboard: {
    all: ["dashboard"] as const,
    programHealth: () => ["dashboard", "program-health"] as const,
    portfolioSummary: () => ["dashboard", "portfolio-summary"] as const,
    realTimeStats: () => ["dashboard", "real-time-stats"] as const,
    activityFeed: (skip: number, limit: number) =>
      ["dashboard", "activity-feed", skip, limit] as const,
    alerts: () => ["dashboard", "alerts"] as const,
  },

  // ── Partner Scoring ────────────────────────────────────────────────────────
  partnerScoring: {
    all: ["partner-scoring"] as const,
    scorecard: (partnerId: string) => ["partner-scoring", "scorecard", partnerId] as const,
    rankings: (skip: number, limit: number) =>
      ["partner-scoring", "rankings", skip, limit] as const,
  },

  // ── Reports ────────────────────────────────────────────────────────────────
  reports: {
    all: ["reports"] as const,
    portfolio: () => ["reports", "portfolio"] as const,
    programStatus: (programId: string) => ["reports", "program-status", programId] as const,
    completion: (programId: string) => ["reports", "completion", programId] as const,
    annual: (year: number) => ["reports", "annual", year] as const,
  },

  // ── Portal ─────────────────────────────────────────────────────────────────
  portal: {
    all: ["portal"] as const,
    profile: () => ["portal", "profile"] as const,
    programs: {
      all: ["portal", "programs"] as const,
      detail: (id: string) => ["portal", "programs", id] as const,
    },
    programStatuses: () => ["portal", "program-statuses"] as const,
    programStatus: (programId: string) => ["portal", "program-status", programId] as const,
    milestones: (params?: unknown) => ["portal", "milestones", params] as const,
    documents: {
      all: ["portal", "documents"] as const,
      detail: (id: string) => ["portal", "documents", id] as const,
    },
    documentRequests: (status?: string) => ["portal", "document-requests", status] as const,
    decisions: {
      history: (params?: unknown) => ["portal", "decisions", "history", params] as const,
    },
  },

  // ── Family Members ─────────────────────────────────────────────────────────
  familyMembers: {
    all: ["family-members"] as const,
    byProfile: (profileId: string) => ["family-members", profileId] as const,
  },

  // ── Intake ─────────────────────────────────────────────────────────────────
  intake: {
    all: ["intake"] as const,
    draft: (profileId: string) => ["intake", profileId] as const,
  },

  // ── Settings / Preferences ─────────────────────────────────────────────────
  settings: {
    notificationPreferences: () => ["notification-preferences"] as const,
    clientPreferences: () => ["client-preferences"] as const,
    preferences: () => ["preferences"] as const,
  },

  // ── Bookmarks ──────────────────────────────────────────────────────────────
  bookmarks: {
    all: ["bookmarks"] as const,
    byType: (entityType?: string) => ["bookmarks", entityType] as const,
  },

  // ── Recent Items ───────────────────────────────────────────────────────────
  recentItems: {
    all: ["recent-items"] as const,
    list: (limit: number, itemType?: string) =>
      ["recent-items", limit, itemType] as const,
  },

  // ── Read Status ────────────────────────────────────────────────────────────
  readStatus: {
    all: ["read-status"] as const,
    entity: (entityType: string, entityId: string) =>
      ["read-status", entityType, entityId] as const,
    list: (entityType: string) => ["read-status", entityType] as const,
    tracker: (entityType: string, itemIds: string[]) =>
      ["read-status", "tracker", entityType, itemIds] as const,
  },

  // ── Global Search ──────────────────────────────────────────────────────────
  searchSuggestions: (query: string) => ["search-suggestions", query] as const,
} as const;
