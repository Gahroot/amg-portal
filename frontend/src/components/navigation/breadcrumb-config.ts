/**
 * Route-to-breadcrumb configuration.
 *
 * Each entry maps a route pattern to a human-readable label and optional
 * resolver that fetches a display name for dynamic segments (e.g. [id]).
 */

import { getProgram } from "@/lib/api/programs";
import { getClientProfile } from "@/lib/api/clients";
import { getPartner } from "@/lib/api/partners";
import { getAssignment } from "@/lib/api/assignments";
import { getDeliverable } from "@/lib/api/deliverables";
import { getEscalation } from "@/lib/api/escalations";
import { getBudgetApprovalRequest } from "@/lib/api/budget-approvals";
import { getCertificate } from "@/lib/api/clearance-certificates";
import { getCapabilityReview } from "@/lib/api/capability-reviews";

export interface BreadcrumbSegmentConfig {
  /** Static label for this segment */
  label: string;
  /** If true, the next path segment is a dynamic ID */
  isDynamic?: boolean;
  /**
   * Resolver: given the dynamic ID (and optional parent params),
   * returns the display name for the breadcrumb.
   */
  resolve?: (id: string, parentParams?: Record<string, string>) => Promise<string>;
}

/**
 * Map of path segments to their breadcrumb config.
 *
 * For nested dynamic routes like /programs/[id]/board, the "board" segment
 * is a child of the dynamic [id] segment under "programs".
 *
 * The key format uses "/" separators to represent the segment hierarchy:
 *  - "programs" → the /programs list page
 *  - "programs/[id]" → resolved name for /programs/:id
 *  - "programs/[id]/board" → "Board" sub-page of a program
 */

type SegmentMap = Record<string, BreadcrumbSegmentConfig>;

// ── Dashboard routes ────────────────────────────────────────────────
export const dashboardSegments: SegmentMap = {
  // Programs
  programs: { label: "Programs" },
  "programs/[id]": {
    label: "Program",
    isDynamic: true,
    resolve: async (id) => {
      const program = await getProgram(id);
      return program.title;
    },
  },
  "programs/[id]/board": { label: "Board" },
  "programs/[id]/closure": { label: "Closure" },
  "programs/[id]/summary": { label: "Summary" },
  "programs/new": { label: "New Program" },

  // Clients
  clients: { label: "Clients" },
  "clients/[id]": {
    label: "Client",
    isDynamic: true,
    resolve: async (id) => {
      const client = await getClientProfile(id);
      return client.display_name || client.legal_name;
    },
  },
  "clients/new": { label: "New Client" },

  // Partners
  partners: { label: "Partners" },
  "partners/[id]": {
    label: "Partner",
    isDynamic: true,
    resolve: async (id) => {
      const partner = await getPartner(id);
      return partner.firm_name;
    },
  },
  "partners/[id]/scorecard": { label: "Scorecard" },
  "partners/new": { label: "New Partner" },
  "partners/governance": { label: "Governance" },

  // Assignments
  assignments: { label: "Assignments" },
  "assignments/[id]": {
    label: "Assignment",
    isDynamic: true,
    resolve: async (id) => {
      const assignment = await getAssignment(id);
      return assignment.title;
    },
  },
  "assignments/new": { label: "New Assignment" },

  // Deliverables
  deliverables: { label: "Deliverables" },
  "deliverables/[id]": {
    label: "Deliverable",
    isDynamic: true,
    resolve: async (id) => {
      const deliverable = await getDeliverable(id);
      return deliverable.title;
    },
  },

  // Escalations
  escalations: { label: "Escalations" },
  "escalations/[id]": {
    label: "Escalation",
    isDynamic: true,
    resolve: async (id) => {
      const escalation = await getEscalation(id);
      return escalation.title;
    },
  },

  // Approvals
  approvals: { label: "Approvals" },
  "approvals/[id]": {
    label: "Approval",
    isDynamic: true,
  },

  // Budget Approvals
  "budget-approvals": { label: "Budget Approvals" },
  "budget-approvals/[id]": {
    label: "Budget Approval",
    isDynamic: true,
    resolve: async (id) => {
      const req = await getBudgetApprovalRequest(id);
      return req.title;
    },
  },

  // Certificates
  certificates: { label: "Certificates" },
  "certificates/[id]": {
    label: "Certificate",
    isDynamic: true,
    resolve: async (id) => {
      const cert = await getCertificate(id);
      return cert.certificate_number || "Certificate";
    },
  },
  "certificates/new": { label: "New Certificate" },
  "certificates/templates": { label: "Templates" },

  // KYC
  kyc: { label: "KYC" },
  "kyc/verifications": { label: "Verifications" },
  "kyc/verifications/[id]": {
    label: "Verification",
    isDynamic: true,
  },
  "kyc/verifications/new": { label: "New Verification" },
  "kyc/alerts": { label: "Alerts" },
  "kyc/reports": { label: "Reports" },

  // Access Audits
  "access-audits": { label: "Access Audits" },
  "access-audits/[id]": {
    label: "Audit",
    isDynamic: true,
  },
  "access-audits/[id]/findings/new": { label: "New Finding" },

  // Audit Logs
  "audit-logs": { label: "Audit Logs" },
  "audit-logs/[id]": {
    label: "Log Entry",
    isDynamic: true,
  },

  // Capability Reviews
  "capability-reviews": { label: "Capability Reviews" },
  "capability-reviews/[id]": {
    label: "Review",
    isDynamic: true,
    resolve: async (id) => {
      const review = await getCapabilityReview(id);
      return review.partner_name || "Review";
    },
  },
  "capability-reviews/new": { label: "New Review" },

  // Deletion Requests
  "deletion-requests": { label: "Deletion Requests" },
  "deletion-requests/[id]": {
    label: "Request",
    isDynamic: true,
  },
  "deletion-requests/new": { label: "New Request" },

  // Compliance
  compliance: { label: "Compliance" },
  "compliance/[id]": { label: "Record", isDynamic: true },

  // Static pages
  portfolio: { label: "Portfolio" },
  tasks: { label: "Tasks" },
  scheduling: { label: "Scheduling" },
  workload: { label: "Workload" },
  finance: { label: "Finance" },
  sla: { label: "SLA Tracking" },
  decisions: { label: "Decisions" },
  "documents/vault": { label: "Document Vault" },
  analytics: { label: "Analytics" },
  "analytics/partner-performance": { label: "Partner Performance" },
  "analytics/nps": { label: "NPS Surveys" },
  reports: { label: "Reports" },
  "reports/schedules": { label: "Schedules" },
  "reports/rm-portfolio": { label: "RM Portfolio" },
  "reports/escalation-log": { label: "Escalation Log" },
  "reports/compliance": { label: "Compliance" },
  communications: { label: "Messages" },
  "communications/templates": { label: "Templates" },
  "communications/log": { label: "Audit Log" },
  notifications: { label: "Notifications" },
  settings: { label: "Settings" },
  "settings/security": { label: "Security" },
  "settings/budget-thresholds": { label: "Budget Thresholds" },
  users: { label: "Users" },
  "users/new": { label: "New User" },
};

// ── Portal routes (client portal, prefix stripped) ──────────────────
export const portalSegments: SegmentMap = {
  dashboard: { label: "Dashboard" },
  programs: { label: "Programs" },
  "programs/[id]": {
    label: "Program",
    isDynamic: true,
    resolve: async (id) => {
      const program = await getProgram(id);
      return program.title;
    },
  },
  messages: { label: "Messages" },
  documents: { label: "Documents" },
  "documents/signing/[id]": { label: "Sign Document", isDynamic: true },
  decisions: { label: "Decisions" },
  survey: { label: "Survey" },
  reports: { label: "Reports" },
  "reports/portfolio": { label: "Portfolio" },
  "reports/program-status": { label: "Program Status" },
  "reports/completion": { label: "Completion" },
  "reports/completion/[programId]": { label: "Report", isDynamic: true },
  "reports/annual": { label: "Annual Review" },
  "reports/annual/[year]": { label: "Year", isDynamic: true },
  settings: { label: "Settings" },
  "settings/profile": { label: "Profile" },
  "settings/notifications": { label: "Notifications" },
  "settings/security": { label: "Security" },
};

// ── Partner routes (prefix stripped) ────────────────────────────────
export const partnerSegments: SegmentMap = {
  onboarding: { label: "Onboarding" },
  assignments: { label: "Assignments" },
  "assignments/[id]": {
    label: "Assignment",
    isDynamic: true,
    resolve: async (id) => {
      const assignment = await getAssignment(id);
      return assignment.title;
    },
  },
  inbox: { label: "Inbox" },
  "inbox/[id]": { label: "Assignment", isDynamic: true },
  deliverables: { label: "Deliverables" },
  "deliverables/[id]": {
    label: "Deliverable",
    isDynamic: true,
    resolve: async (id) => {
      const deliverable = await getDeliverable(id);
      return deliverable.title;
    },
  },
  messages: { label: "Messages" },
  "messages/[id]": { label: "Thread", isDynamic: true },
  documents: { label: "Documents" },
  notices: { label: "Notices" },
  "capability-refresh": { label: "Capability Refresh" },
  reports: { label: "Reports" },
  "reports/brief-summary": { label: "Brief Summary" },
  "reports/feedback": { label: "Feedback" },
  "reports/history": { label: "History" },
  settings: { label: "Settings" },
  "settings/profile": { label: "Profile" },
  "settings/notifications": { label: "Notifications" },
  "settings/security": { label: "Security" },
};
