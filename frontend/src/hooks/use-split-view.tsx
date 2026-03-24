"use client";

import * as React from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";

/**
 * Entity types that can be shown in split view
 */
export type SplitViewEntityType = "client" | "program" | "partner" | "task" | "message" | "deliverable";

/**
 * Represents a panel in the split view
 */
export interface SplitViewPanel {
  /** Type of entity being displayed */
  entityType: SplitViewEntityType;
  /** ID of the entity */
  entityId: string;
  /** Optional title for the panel header */
  title?: string;
}

/**
 * Split view configuration
 */
export interface SplitViewState {
  /** Whether split view is active */
  isSplitView: boolean;
  /** Left panel content */
  leftPanel: SplitViewPanel | null;
  /** Right panel content */
  rightPanel: SplitViewPanel | null;
  /** Split ratio (0.1 to 0.9, represents left panel width percentage) */
  splitRatio: number;
  /** Whether scroll should be synced between panels */
  syncScroll: boolean;
}

interface SplitViewContextValue extends SplitViewState {
  /** Enter split view with two panels */
  enterSplitView: (left: SplitViewPanel, right: SplitViewPanel, ratio?: number) => void;
  /** Exit split view (closes right panel, keeps left) */
  exitSplitView: () => void;
  /** Swap left and right panels */
  swapPanels: () => void;
  /** Close a specific panel */
  closePanel: (side: "left" | "right") => void;
  /** Update the split ratio */
  setSplitRatio: (ratio: number) => void;
  /** Toggle scroll sync */
  toggleSyncScroll: () => void;
  /** Update a panel's content */
  updatePanel: (side: "left" | "right", panel: SplitViewPanel) => void;
  /** Set only the left panel (single view mode) */
  setLeftPanel: (panel: SplitViewPanel | null) => void;
  /** Set only the right panel (will enter split view if left exists) */
  setRightPanel: (panel: SplitViewPanel | null) => void;
}

const SplitViewContext = React.createContext<SplitViewContextValue | null>(null);

const MIN_SPLIT_RATIO = 0.2;
const MAX_SPLIT_RATIO = 0.8;
const DEFAULT_SPLIT_RATIO = 0.5;

/**
 * Parse split view params from URL query string
 * Format: ?split=entityType:entityId,entityType:entityId&ratio=0.5
 */
function parseSplitParams(searchParams: URLSearchParams): {
  leftPanel: SplitViewPanel | null;
  rightPanel: SplitViewPanel | null;
  splitRatio: number;
} {
  const splitParam = searchParams.get("split");
  const ratioParam = searchParams.get("ratio");

  let leftPanel: SplitViewPanel | null = null;
  let rightPanel: SplitViewPanel | null = null;
  let splitRatio = DEFAULT_SPLIT_RATIO;

  if (splitParam) {
    const panels = splitParam.split(",").map((panel) => {
      const [entityType, entityId] = panel.split(":");
      return { entityType: entityType as SplitViewEntityType, entityId };
    });

    if (panels[0] && panels[0].entityType && panels[0].entityId) {
      leftPanel = panels[0];
    }
    if (panels[1] && panels[1].entityType && panels[1].entityId) {
      rightPanel = panels[1];
    }
  }

  if (ratioParam) {
    const parsed = parseFloat(ratioParam);
    if (!isNaN(parsed) && parsed >= MIN_SPLIT_RATIO && parsed <= MAX_SPLIT_RATIO) {
      splitRatio = parsed;
    }
  }

  return { leftPanel, rightPanel, splitRatio };
}

/**
 * Build URL search params with split view state
 */
function buildSplitUrl(
  pathname: string,
  leftPanel: SplitViewPanel | null,
  rightPanel: SplitViewPanel | null,
  splitRatio: number,
  existingParams: URLSearchParams
): string {
  const params = new URLSearchParams(existingParams);

  if (leftPanel && rightPanel) {
    params.set(
      "split",
      `${leftPanel.entityType}:${leftPanel.entityId},${rightPanel.entityType}:${rightPanel.entityId}`
    );
    if (splitRatio !== DEFAULT_SPLIT_RATIO) {
      params.set("ratio", splitRatio.toFixed(2));
    } else {
      params.delete("ratio");
    }
  } else {
    params.delete("split");
    params.delete("ratio");
  }

  const paramString = params.toString();
  return paramString ? `${pathname}?${paramString}` : pathname;
}

/**
 * Hook to access split view state
 * Must be used within a SplitViewProvider
 */
export function useSplitView(): SplitViewContextValue {
  const context = React.useContext(SplitViewContext);
  if (!context) {
    throw new Error("useSplitView must be used within a SplitViewProvider");
  }
  return context;
}

interface SplitViewProviderProps {
  children: React.ReactNode;
  /** Whether to persist split view state in URL */
  syncWithUrl?: boolean;
}

/**
 * Provider for split view state
 * Manages split view configuration with optional URL synchronization
 */
export function SplitViewProvider({
  children,
  syncWithUrl = true,
}: SplitViewProviderProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Initialize state from URL params if available
  const { leftPanel: initialLeft, rightPanel: initialRight, splitRatio: initialRatio } =
    React.useMemo(() => parseSplitParams(searchParams), [searchParams]);

  const [leftPanel, setLeftPanelState] = React.useState<SplitViewPanel | null>(initialLeft);
  const [rightPanel, setRightPanelState] = React.useState<SplitViewPanel | null>(initialRight);
  const [splitRatio, setSplitRatioState] = React.useState(initialRatio);
  const [syncScroll, setSyncScroll] = React.useState(false);

  // Update URL when split view state changes
  const updateUrl = React.useCallback(
    (newLeft: SplitViewPanel | null, newRight: SplitViewPanel | null, newRatio: number) => {
      if (!syncWithUrl) return;

      const newUrl = buildSplitUrl(pathname, newLeft, newRight, newRatio, searchParams);
      router.replace(newUrl, { scroll: false });
    },
    [pathname, router, searchParams, syncWithUrl]
  );

  const isSplitView = leftPanel !== null && rightPanel !== null;

  const enterSplitView = React.useCallback(
    (left: SplitViewPanel, right: SplitViewPanel, ratio = DEFAULT_SPLIT_RATIO) => {
      const clampedRatio = Math.max(MIN_SPLIT_RATIO, Math.min(MAX_SPLIT_RATIO, ratio));
      setLeftPanelState(left);
      setRightPanelState(right);
      setSplitRatioState(clampedRatio);
      updateUrl(left, right, clampedRatio);
    },
    [updateUrl]
  );

  const exitSplitView = React.useCallback(() => {
    // Keep left panel, close right
    setRightPanelState(null);
    updateUrl(leftPanel, null, splitRatio);
  }, [leftPanel, splitRatio, updateUrl]);

  const swapPanels = React.useCallback(() => {
    if (!leftPanel || !rightPanel) return;
    setLeftPanelState(rightPanel);
    setRightPanelState(leftPanel);
    updateUrl(rightPanel, leftPanel, 1 - splitRatio);
    setSplitRatioState(1 - splitRatio);
  }, [leftPanel, rightPanel, splitRatio, updateUrl]);

  const closePanel = React.useCallback(
    (side: "left" | "right") => {
      if (side === "left") {
        // If we have a right panel, it becomes the left panel
        if (rightPanel) {
          setLeftPanelState(rightPanel);
          setRightPanelState(null);
          updateUrl(rightPanel, null, splitRatio);
        } else {
          setLeftPanelState(null);
          updateUrl(null, null, splitRatio);
        }
      } else {
        setRightPanelState(null);
        updateUrl(leftPanel, null, splitRatio);
      }
    },
    [leftPanel, rightPanel, splitRatio, updateUrl]
  );

  const setSplitRatio = React.useCallback(
    (ratio: number) => {
      const clampedRatio = Math.max(MIN_SPLIT_RATIO, Math.min(MAX_SPLIT_RATIO, ratio));
      setSplitRatioState(clampedRatio);
      updateUrl(leftPanel, rightPanel, clampedRatio);
    },
    [leftPanel, rightPanel, updateUrl]
  );

  const toggleSyncScroll = React.useCallback(() => {
    setSyncScroll((prev) => !prev);
  }, []);

  const updatePanel = React.useCallback(
    (side: "left" | "right", panel: SplitViewPanel) => {
      if (side === "left") {
        setLeftPanelState(panel);
        updateUrl(panel, rightPanel, splitRatio);
      } else {
        setRightPanelState(panel);
        updateUrl(leftPanel, panel, splitRatio);
      }
    },
    [rightPanel, leftPanel, splitRatio, updateUrl]
  );

  const setLeftPanel = React.useCallback(
    (panel: SplitViewPanel | null) => {
      setLeftPanelState(panel);
      if (panel && rightPanel) {
        updateUrl(panel, rightPanel, splitRatio);
      } else {
        updateUrl(panel, null, splitRatio);
      }
    },
    [rightPanel, splitRatio, updateUrl]
  );

  const setRightPanel = React.useCallback(
    (panel: SplitViewPanel | null) => {
      setRightPanelState(panel);
      if (leftPanel && panel) {
        updateUrl(leftPanel, panel, splitRatio);
      } else {
        updateUrl(leftPanel, panel, splitRatio);
      }
    },
    [leftPanel, splitRatio, updateUrl]
  );

  const value = React.useMemo(
    () => ({
      isSplitView,
      leftPanel,
      rightPanel,
      splitRatio,
      syncScroll,
      enterSplitView,
      exitSplitView,
      swapPanels,
      closePanel,
      setSplitRatio,
      toggleSyncScroll,
      updatePanel,
      setLeftPanel,
      setRightPanel,
    }),
    [
      isSplitView,
      leftPanel,
      rightPanel,
      splitRatio,
      syncScroll,
      enterSplitView,
      exitSplitView,
      swapPanels,
      closePanel,
      setSplitRatio,
      toggleSyncScroll,
      updatePanel,
      setLeftPanel,
      setRightPanel,
    ]
  );

  return (
    <SplitViewContext.Provider value={value}>
      {children}
    </SplitViewContext.Provider>
  );
}

/**
 * Utility function to get entity path based on type
 */
export function getEntityPath(entityType: SplitViewEntityType, entityId: string): string {
  const paths: Record<SplitViewEntityType, string> = {
    client: `/clients/${entityId}`,
    program: `/programs/${entityId}`,
    partner: `/partners/${entityId}`,
    task: `/tasks?task=${entityId}`,
    message: `/communications?message=${entityId}`,
    deliverable: `/deliverables/${entityId}`,
  };
  return paths[entityType];
}

/**
 * Utility function to get entity label based on type
 */
export function getEntityLabel(entityType: SplitViewEntityType): string {
  const labels: Record<SplitViewEntityType, string> = {
    client: "Client",
    program: "Program",
    partner: "Partner",
    task: "Task",
    message: "Message",
    deliverable: "Deliverable",
  };
  return labels[entityType];
}
