"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import type { UserRole } from "@/types/user";
import {
  FolderPlus,
  UserPlus,
  Building2,
  CheckSquare,
  Mail,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { getNavConfigForRole, getFlatNavItems } from "@/lib/nav-utils";

/**
 * Quick action definition
 */
export interface QuickAction {
  /** Unique identifier for the action */
  id: string;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Icon to display */
  icon: LucideIcon;
  /** Category for grouping */
  category: QuickActionCategory;
  /** Keyboard shortcut (e.g., "n", "e") */
  shortcut?: string;
  /** Whether this action requires meta key (Cmd/Ctrl) */
  shortcutMetaKey?: boolean;
  /** Handler when action is triggered */
  handler: (context: QuickActionContext) => void;
  /** Whether this action is disabled */
  disabled?: boolean | ((context: QuickActionContext) => boolean);
  /** Whether to show this action in the menu */
  visible?: boolean | ((context: QuickActionContext) => boolean);
  /** Sort order within category (lower = higher priority) */
  order?: number;
}

/**
 * Quick action categories
 */
export type QuickActionCategory =
  | "create"
  | "export"
  | "communication"
  | "navigation"
  | "common";

/**
 * Context passed to quick actions
 */
export interface QuickActionContext {
  /** Current pathname */
  pathname: string;
  /** Current page type */
  pageType: PageType;
  /** Current user role */
  userRole: UserRole;
  /** Selected item IDs (if any) */
  selectedIds?: string[];
  /** Additional context data */
  data?: Record<string, unknown>;
}

/**
 * Page types for context detection
 */
export type PageType =
  | "dashboard"
  | "programs"
  | "program-detail"
  | "program-new"
  | "clients"
  | "client-detail"
  | "partners"
  | "partner-detail"
  | "approvals"
  | "escalations"
  | "communications"
  | "documents"
  | "tasks"
  | "reports"
  | "settings"
  | "portal-dashboard"
  | "portal-programs"
  | "portal-documents"
  | "partner-dashboard"
  | "partner-programs"
  | "partner-assignments"
  | "unknown";

const HARDCODED_ACTION_HREFS = new Set([
  "/programs/new",
  "/clients/new",
  "/partners/new",
  "/communications",
  "/escalations",
  "/approvals",
]);

/**
 * Detect page type from pathname
 */
export function detectPageType(pathname: string): PageType {
  // Portal routes
  if (pathname.startsWith("/portal")) {
    if (pathname === "/portal/dashboard") return "portal-dashboard";
    if (pathname.includes("/portal/programs")) return "portal-programs";
    if (pathname.includes("/portal/documents")) return "portal-documents";
    return "unknown";
  }

  // Partner routes
  if (pathname.startsWith("/partner")) {
    if (pathname === "/partner" || pathname === "/partner/") return "partner-dashboard";
    if (pathname.includes("/partner/programs")) return "partner-programs";
    if (pathname.includes("/partner/assignments")) return "partner-assignments";
    return "unknown";
  }

  // Dashboard routes
  if (pathname === "/" || pathname === "/dashboard") return "dashboard";
  if (pathname === "/programs" || pathname.startsWith("/programs")) {
    if (pathname === "/programs/new") return "program-new";
    if (pathname.match(/^\/programs\/[^/]+$/)) return "program-detail";
    return "programs";
  }
  if (pathname === "/clients" || pathname.startsWith("/clients")) {
    if (pathname.match(/^\/clients\/[^/]+$/)) return "client-detail";
    return "clients";
  }
  if (pathname === "/partners" || pathname.startsWith("/partners")) {
    if (pathname.match(/^\/partners\/[^/]+$/)) return "partner-detail";
    return "partners";
  }
  if (pathname.includes("/approvals")) return "approvals";
  if (pathname.includes("/escalations")) return "escalations";
  if (pathname.includes("/communications")) return "communications";
  if (pathname.includes("/documents")) return "documents";
  if (pathname.includes("/tasks")) return "tasks";
  if (pathname.includes("/reports")) return "reports";
  if (pathname.includes("/settings")) return "settings";

  return "unknown";
}

/**
 * Get default actions for a page type and role
 */
export function getDefaultActionsForContext(
  pageType: PageType,
  userRole: UserRole,
  router: ReturnType<typeof useRouter>
): QuickAction[] {
  const actions: QuickAction[] = [];
  const isInternal = [
    "managing_director",
    "relationship_manager",
    "coordinator",
    "finance_compliance",
  ].includes(userRole);
  const isMD = userRole === "managing_director";
  const isRM = userRole === "relationship_manager";
  const isCoordinator = userRole === "coordinator";

  // Create actions
  if (isInternal) {
    // New program - available on dashboard, programs list
    if (["dashboard", "programs"].includes(pageType) && (isMD || isRM)) {
      actions.push({
        id: "new-program",
        label: "New Program",
        description: "Create a new program",
        icon: FolderPlus,
        category: "create",
        shortcut: "n",
        shortcutMetaKey: false,
        handler: () => router.push("/programs/new"),
        order: 1,
      });
    }

    // New client
    if (["dashboard", "clients"].includes(pageType)) {
      actions.push({
        id: "new-client",
        label: "New Client",
        description: "Add a new client",
        icon: UserPlus,
        category: "create",
        handler: () => router.push("/clients/new"),
        order: 2,
      });
    }

    // New partner
    if (["dashboard", "partners"].includes(pageType)) {
      actions.push({
        id: "new-partner",
        label: "New Partner",
        description: "Add a new partner",
        icon: Building2,
        category: "create",
        handler: () => router.push("/partners/new"),
        order: 3,
      });
    }

    // New task
    actions.push({
      id: "new-task",
      label: "New Task",
      description: "Create a quick task",
      icon: CheckSquare,
      category: "create",
      shortcut: "t",
      shortcutMetaKey: false,
      handler: () => {
        // Dispatch custom event that QuickTaskButton listens to
        window.dispatchEvent(new CustomEvent("quick-actions:new-task"));
      },
      order: 10,
    });
  }

  // Communication actions
  if (isInternal && (isMD || isRM || isCoordinator)) {
    actions.push({
      id: "new-communication",
      label: "New Communication",
      description: "Log a communication",
      icon: Mail,
      category: "communication",
      handler: () => router.push("/communications"),
      order: 20,
    });

    actions.push({
      id: "new-escalation",
      label: "New Escalation",
      description: "Create an escalation",
      icon: AlertTriangle,
      category: "communication",
      handler: () => router.push("/escalations"),
      order: 21,
    });
  }

  // Export actions
  if (["programs", "clients", "partners", "reports"].includes(pageType)) {
    actions.push({
      id: "export-csv",
      label: "Export CSV",
      description: "Export current view as CSV",
      icon: FileSpreadsheet,
      category: "export",
      shortcut: "e",
      shortcutMetaKey: false,
      handler: () => {
        window.dispatchEvent(new CustomEvent("quick-actions:export-csv"));
      },
      order: 30,
    });

    actions.push({
      id: "export-pdf",
      label: "Export PDF",
      description: "Export current view as PDF",
      icon: FileText,
      category: "export",
      handler: () => {
        window.dispatchEvent(new CustomEvent("quick-actions:export-pdf"));
      },
      order: 31,
    });
  }

  // Common actions
  if (isInternal) {
    actions.push({
      id: "review-pending",
      label: "Review Pending",
      description: "View pending approvals",
      icon: ClipboardList,
      category: "common",
      handler: () => router.push("/approvals"),
      order: 40,
    });
  }

  // Navigation actions from nav configs
  const navConfig = getNavConfigForRole(userRole);
  const navItems = getFlatNavItems(navConfig, userRole)
    .filter((item) => !item.isSubItem && !HARDCODED_ACTION_HREFS.has(item.href));

  navItems.forEach((item, index) => {
    actions.push({
      id: `nav-${item.href}`,
      label: item.title,
      description: item.tooltip || `Go to ${item.title}`,
      icon: item.icon,
      category: "navigation",
      handler: () => router.push(item.href),
      order: 50 + index,
    });
  });

  return actions;
}

/**
 * Category display info
 */
export const QUICK_ACTION_CATEGORIES: Record<QuickActionCategory, { label: string; order: number }> = {
  create: { label: "Create", order: 1 },
  communication: { label: "Communication", order: 2 },
  export: { label: "Export", order: 3 },
  navigation: { label: "Navigation", order: 4 },
  common: { label: "Common", order: 5 },
};

/**
 * Quick actions context
 */
interface QuickActionsContextType {
  /** Current context */
  context: QuickActionContext;
  /** All available actions for current context */
  actions: QuickAction[];
  /** Pinned actions */
  pinnedActions: QuickAction[];
  /** Pin an action */
  pinAction: (actionId: string) => void;
  /** Unpin an action */
  unpinAction: (actionId: string) => void;
  /** Toggle pin status */
  togglePin: (actionId: string) => void;
  /** Reorder an action */
  reorderAction: (actionId: string, newOrder: number) => void;
  /** Execute an action */
  executeAction: (action: QuickAction) => void;
  /** Whether menu is open */
  isOpen: boolean;
  /** Open menu */
  openMenu: () => void;
  /** Close menu */
  closeMenu: () => void;
  /** Toggle menu */
  toggleMenu: () => void;
  /** Check if action is pinned */
  isPinned: (actionId: string) => boolean;
}

const QuickActionsContext = React.createContext<QuickActionsContextType | null>(null);

/**
 * Storage key for persisting preferences
 */
const STORAGE_KEY = "amg-quick-actions";

/**
 * Quick actions store state
 */
interface QuickActionsState {
  /** Pinned action IDs */
  pinnedActions: string[];
  /** Custom action order within categories */
  customOrder: Record<string, number>;
  /** Whether the menu is open */
  isOpen: boolean;
}

/**
 * Load state from localStorage
 */
function loadState(): QuickActionsState {
  if (typeof window === "undefined") {
    return { pinnedActions: [], customOrder: {}, isOpen: false };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        pinnedActions: parsed.pinnedActions || [],
        customOrder: parsed.customOrder || {},
        isOpen: false,
      };
    }
  } catch {
    // Ignore parse errors
  }

  return { pinnedActions: [], customOrder: {}, isOpen: false };
}

/**
 * Save state to localStorage
 */
function saveState(state: QuickActionsState): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        pinnedActions: state.pinnedActions,
        customOrder: state.customOrder,
      })
    );
  } catch {
    // Ignore storage errors
  }
}

/**
 * Quick Actions Provider
 */
export function QuickActionsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const [state, setState] = React.useState<QuickActionsState>(loadState);

  // Build context
  const context: QuickActionContext = React.useMemo(() => ({
    pathname,
    pageType: detectPageType(pathname),
    userRole: user?.role || "client",
  }), [pathname, user?.role]);

  // Get actions for current context
  const allActions = React.useMemo(() => {
    return getDefaultActionsForContext(context.pageType, context.userRole, router);
  }, [context.pageType, context.userRole, router]);

  // Sort actions by order and custom order
  const actions = React.useMemo(() => {
    return [...allActions].sort((a, b) => {
      const orderA = state.customOrder[a.id] ?? a.order ?? 100;
      const orderB = state.customOrder[b.id] ?? b.order ?? 100;
      return orderA - orderB;
    });
  }, [allActions, state.customOrder]);

  // Get pinned actions
  const pinnedActions = React.useMemo(() => {
    return actions.filter((a) => state.pinnedActions.includes(a.id));
  }, [actions, state.pinnedActions]);

  // Pin/unpin actions
  const pinAction = React.useCallback((actionId: string) => {
    setState((prev) => {
      if (prev.pinnedActions.includes(actionId)) return prev;
      const newState = {
        ...prev,
        pinnedActions: [...prev.pinnedActions, actionId],
      };
      saveState(newState);
      return newState;
    });
  }, []);

  const unpinAction = React.useCallback((actionId: string) => {
    setState((prev) => {
      const newState = {
        ...prev,
        pinnedActions: prev.pinnedActions.filter((id) => id !== actionId),
      };
      saveState(newState);
      return newState;
    });
  }, []);

  const togglePin = React.useCallback((actionId: string) => {
    setState((prev) => {
      const isPinned = prev.pinnedActions.includes(actionId);
      const newState = {
        ...prev,
        pinnedActions: isPinned
          ? prev.pinnedActions.filter((id) => id !== actionId)
          : [...prev.pinnedActions, actionId],
      };
      saveState(newState);
      return newState;
    });
  }, []);

  const reorderAction = React.useCallback((actionId: string, newOrder: number) => {
    setState((prev) => {
      const newState = {
        ...prev,
        customOrder: { ...prev.customOrder, [actionId]: newOrder },
      };
      saveState(newState);
      return newState;
    });
  }, []);

  // Execute action
  const executeAction = React.useCallback((action: QuickAction) => {
    // Check if disabled
    const disabled = typeof action.disabled === "function"
      ? action.disabled(context)
      : action.disabled;
    if (disabled) return;

    action.handler(context);
    setState((prev) => ({ ...prev, isOpen: false }));
  }, [context]);

  // Menu state
  const openMenu = React.useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: true }));
  }, []);

  const closeMenu = React.useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const toggleMenu = React.useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  // Check if action is pinned
  const isPinned = React.useCallback((actionId: string) => {
    return state.pinnedActions.includes(actionId);
  }, [state.pinnedActions]);

  const value = React.useMemo(() => ({
    context,
    actions,
    pinnedActions,
    pinAction,
    unpinAction,
    togglePin,
    reorderAction,
    executeAction,
    isOpen: state.isOpen,
    openMenu,
    closeMenu,
    toggleMenu,
    isPinned,
  }), [
    context,
    actions,
    pinnedActions,
    pinAction,
    unpinAction,
    togglePin,
    reorderAction,
    executeAction,
    state.isOpen,
    openMenu,
    closeMenu,
    toggleMenu,
    isPinned,
  ]);

  return (
    <QuickActionsContext.Provider value={value}>
      {children}
    </QuickActionsContext.Provider>
  );
}

/**
 * Hook to access quick actions context
 */
export function useQuickActions(): QuickActionsContextType {
  const context = React.useContext(QuickActionsContext);
  if (!context) {
    throw new Error("useQuickActions must be used within a QuickActionsProvider");
  }
  return context;
}

// Re-export types for convenience
export type { QuickAction as QuickActionType, QuickActionContext as QuickActionContextType };
