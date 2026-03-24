"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";

export interface HelpContext {
  /** Current route path */
  pathname: string;
  /** Detected page type (e.g., 'dashboard', 'clients', 'programs') */
  pageType: string;
  /** User role for role-specific help */
  userRole: string | undefined;
  /** Whether this is a detail page (viewing a specific item) */
  isDetailPage: boolean;
  /** Whether this is a create/edit form */
  isFormPage: boolean;
  /** Breadcrumb context for help content */
  breadcrumbContext: string[];
}

/**
 * Hook to detect the current help context based on route and user role
 */
export function useHelpContext(): HelpContext {
  const pathname = usePathname();
  const { user } = useAuth();

  return useMemo(() => {
    // Parse the pathname to determine page type
    const segments = pathname.split("/").filter(Boolean);
    
    // Determine page type from first segment
    let pageType = "dashboard";
    if (segments.length > 0) {
      // Map route segments to page types
      const routeMap: Record<string, string> = {
        "": "dashboard",
        clients: "clients",
        partners: "partners",
        programs: "programs",
        tasks: "tasks",
        deliverables: "deliverables",
        assignments: "assignments",
        scheduling: "scheduling",
        approvals: "approvals",
        "budget-approvals": "budget-approvals",
        finance: "finance",
        compliance: "compliance",
        certificates: "certificates",
        sla: "sla",
        escalations: "escalations",
        "audit-logs": "audit-logs",
        decisions: "decisions",
        "deletion-requests": "deletion-requests",
        "access-audits": "access-audits",
        analytics: "analytics",
        reports: "reports",
        communications: "communications",
        notifications: "notifications",
        settings: "settings",
        portfolio: "portfolio",
        workload: "workload",
        users: "users",
        kyc: "kyc",
        "capability-reviews": "capability-reviews",
      };
      pageType = routeMap[segments[0]] || segments[0];
    }

    // Detect if on a detail page (has UUID or 'new' as second segment)
    const isDetailPage = segments.length >= 2 && 
      (segments[1] !== "new" && segments[1] !== "edit" && !segments[1].startsWith("["));
    
    // Detect if on a form page
    const isFormPage = segments.includes("new") || segments.includes("edit");

    // Build breadcrumb context
    const breadcrumbContext = segments.map((segment, index) => {
      // Skip UUIDs, use the parent context
      if (segment.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return `item-${index}`;
      }
      return segment;
    });

    return {
      pathname,
      pageType,
      userRole: user?.role,
      isDetailPage,
      isFormPage,
      breadcrumbContext,
    };
  }, [pathname, user?.role]);
}

/**
 * Get a human-readable page title from the page type
 */
export function getPageTitle(pageType: string): string {
  const titles: Record<string, string> = {
    dashboard: "Dashboard",
    clients: "Clients",
    partners: "Partners",
    programs: "Programs",
    tasks: "Task Board",
    deliverables: "Deliverables",
    assignments: "Assignments",
    scheduling: "Scheduling",
    approvals: "Approvals",
    "budget-approvals": "Budget Approvals",
    finance: "Finance",
    compliance: "Compliance",
    certificates: "Certificates",
    sla: "SLA Tracking",
    escalations: "Escalations",
    "audit-logs": "Audit Logs",
    decisions: "Decisions",
    "deletion-requests": "Deletion Requests",
    "access-audits": "Access Audits",
    analytics: "Analytics",
    reports: "Reports",
    communications: "Messages",
    notifications: "Notifications",
    settings: "Settings",
    portfolio: "My Portfolio",
    workload: "Workload",
    users: "Users",
    kyc: "KYC",
    "capability-reviews": "Capability Reviews",
  };
  return titles[pageType] || pageType.charAt(0).toUpperCase() + pageType.slice(1);
}
