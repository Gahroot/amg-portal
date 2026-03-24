"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  useSplitView,
  getEntityPath,
  getEntityLabel,
  type SplitViewPanel,
  type SplitViewEntityType,
} from "@/hooks/use-split-view";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Columns2,
  X,
  ArrowLeftRight,
  Pin,
  PinOff,
  Maximize2,
  ExternalLink,
  GripVertical,
} from "lucide-react";

/**
 * Props for the SplitViewContainer component
 */
interface SplitViewContainerProps {
  /** Content to render when not in split view */
  children: React.ReactNode;
  /** Custom class name for the container */
  className?: string;
}

/**
 * Props for individual split view panels
 */
interface SplitViewPanelContentProps {
  /** Panel data */
  panel: SplitViewPanel;
  /** Side of the panel (left or right) */
  side: "left" | "right";
  /** Whether this is in split view mode */
  isSplit: boolean;
  /** Callback when panel wants to open in split view */
  onOpenSplit?: (panel: SplitViewPanel) => void;
  /** Callback to close this panel */
  onClose?: () => void;
  /** Callback to open panel in full page */
  onOpenFull?: () => void;
}

/**
 * Props for the panel content wrapper
 */
interface SplitPanelWrapperProps {
  children: React.ReactNode;
  side: "left" | "right";
  panel: SplitViewPanel | null;
  onClose?: () => void;
  onOpenFull?: () => void;
  syncScroll?: boolean;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * Draggable resize handle between panels
 */
function ResizeHandle({
  onDrag,
  splitRatio,
}: {
  onDrag: (delta: number) => void;
  splitRatio: number;
}) {
  const [isDragging, setIsDragging] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const container = containerRef.current.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const newRatio = (e.clientX - rect.left) / rect.width;
      // Clamp between 20% and 80%
      const clampedRatio = Math.max(0.2, Math.min(0.8, newRatio));
      onDrag(clampedRatio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = isDragging ? "col-resize" : "";
    document.body.style.userSelect = isDragging ? "none" : "";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, onDrag]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative z-10 flex w-1.5 cursor-col-resize items-center justify-center transition-colors",
        "hover:bg-primary/20",
        isDragging && "bg-primary/30"
      )}
      onMouseDown={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panels"
      aria-valuenow={Math.round(splitRatio * 100)}
    >
      <div className="flex h-8 w-1 items-center justify-center rounded-full bg-border">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

/**
 * Panel wrapper with header and close button
 */
function SplitPanelWrapper({
  children,
  side,
  panel,
  onClose,
  onOpenFull,
  syncScroll,
  scrollRef,
}: SplitPanelWrapperProps) {
  if (!panel) {
    return (
      <div className="flex h-full items-center justify-center border-r bg-muted/30">
        <div className="text-center text-muted-foreground">
          <Columns2 className="mx-auto h-12 w-12 opacity-50" />
          <p className="mt-2 text-sm">No content selected</p>
          <p className="text-xs">Select an item to view in split mode</p>
        </div>
      </div>
    );
  }

  const entityLabel = getEntityLabel(panel.entityType);
  const entityPath = getEntityPath(panel.entityType, panel.entityId);

  return (
    <div className="flex h-full flex-col overflow-hidden border-r last:border-r-0">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {entityLabel}
          </span>
          {panel.title && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="truncate text-sm font-medium">{panel.title}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onOpenFull && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onOpenFull}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Open in full page</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {onClose && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onClose}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Close panel</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      {/* Panel Content */}
      <div
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-auto",
          syncScroll && "scroll-smooth"
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Placeholder content when no entity is loaded
 */
function EmptyPanelContent({ entityType }: { entityType?: SplitViewEntityType }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center text-muted-foreground">
        {entityType ? (
          <>
            <p className="text-sm">Loading {getEntityLabel(entityType).toLowerCase()}...</p>
          </>
        ) : (
          <>
            <Columns2 className="mx-auto h-12 w-12 opacity-50" />
            <p className="mt-2 text-sm">Select an item to view</p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Main split view container component
 * Wraps the main content and shows split panels when activated
 */
export function SplitViewContainer({
  children,
  className,
}: SplitViewContainerProps) {
  const {
    isSplitView,
    leftPanel,
    rightPanel,
    splitRatio,
    syncScroll,
    setSplitRatio,
    closePanel,
    swapPanels,
    toggleSyncScroll,
  } = useSplitView();

  const router = useRouter();
  const leftScrollRef = React.useRef<HTMLDivElement>(null);
  const rightScrollRef = React.useRef<HTMLDivElement>(null);

  // Sync scroll between panels when enabled
  React.useEffect(() => {
    if (!syncScroll || !isSplitView) return;

    const leftEl = leftScrollRef.current;
    const rightEl = rightScrollRef.current;
    if (!leftEl || !rightEl) return;

    let isLeftScrolling = false;
    let isRightScrolling = false;

    const syncLeftToRight = () => {
      if (isRightScrolling) return;
      isLeftScrolling = true;
      const scrollRatio = leftEl.scrollTop / (leftEl.scrollHeight - leftEl.clientHeight);
      rightEl.scrollTop = scrollRatio * (rightEl.scrollHeight - rightEl.clientHeight);
      requestAnimationFrame(() => {
        isLeftScrolling = false;
      });
    };

    const syncRightToLeft = () => {
      if (isLeftScrolling) return;
      isRightScrolling = true;
      const scrollRatio = rightEl.scrollTop / (rightEl.scrollHeight - rightEl.clientHeight);
      leftEl.scrollTop = scrollRatio * (leftEl.scrollHeight - leftEl.clientHeight);
      requestAnimationFrame(() => {
        isRightScrolling = false;
      });
    };

    leftEl.addEventListener("scroll", syncLeftToRight);
    rightEl.addEventListener("scroll", syncRightToLeft);

    return () => {
      leftEl.removeEventListener("scroll", syncLeftToRight);
      rightEl.removeEventListener("scroll", syncRightToLeft);
    };
  }, [syncScroll, isSplitView]);

  // If not in split view, just render children
  if (!isSplitView) {
    return <div className={className}>{children}</div>;
  }

  const handleOpenFullLeft = () => {
    if (leftPanel) {
      router.push(getEntityPath(leftPanel.entityType, leftPanel.entityId));
    }
  };

  const handleOpenFullRight = () => {
    if (rightPanel) {
      router.push(getEntityPath(rightPanel.entityType, rightPanel.entityId));
    }
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Split View Toolbar */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Columns2 className="h-3.5 w-3.5" />
          <span>Split View</span>
          <span className="text-muted-foreground/50">|</span>
          <span>{Math.round(splitRatio * 100)}% / {Math.round((1 - splitRatio) * 100)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={toggleSyncScroll}
                >
                  {syncScroll ? (
                    <>
                      <PinOff className="h-3 w-3" />
                      Unsync
                    </>
                  ) : (
                    <>
                      <Pin className="h-3 w-3" />
                      Sync Scroll
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {syncScroll ? "Disable synchronized scrolling" : "Enable synchronized scrolling"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={swapPanels}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Swap panels</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Split Panels Container */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: `${splitRatio * 100}%` }}
        >
          <SplitPanelWrapper
            side="left"
            panel={leftPanel}
            onClose={() => closePanel("left")}
            onOpenFull={handleOpenFullLeft}
            syncScroll={syncScroll}
            scrollRef={leftScrollRef}
          >
            <SplitPanelContent
              panel={leftPanel}
              side="left"
              isSplit={true}
            />
          </SplitPanelWrapper>
        </div>

        {/* Resize Handle */}
        <ResizeHandle
          splitRatio={splitRatio}
          onDrag={setSplitRatio}
        />

        {/* Right Panel */}
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: `${(1 - splitRatio) * 100}%` }}
        >
          <SplitPanelWrapper
            side="right"
            panel={rightPanel}
            onClose={() => closePanel("right")}
            onOpenFull={handleOpenFullRight}
            syncScroll={syncScroll}
            scrollRef={rightScrollRef}
          >
            <SplitPanelContent
              panel={rightPanel}
              side="right"
              isSplit={true}
            />
          </SplitPanelWrapper>
        </div>
      </div>
    </div>
  );
}

/**
 * Content renderer for split view panels
 * Uses iframe to load entity pages in isolation
 */
function SplitPanelContent({
  panel,
  side,
  isSplit,
}: SplitPanelPanelContentProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const entityPath = getEntityPath(panel.entityType, panel.entityId);

  React.useEffect(() => {
    setIsLoading(true);
  }, [entityPath]);

  // Note: In a production app, we might want to render the actual component
  // instead of using an iframe. For now, we use an iframe for simplicity
  // and to avoid re-fetching data.

  return (
    <div className="relative h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="text-center text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
            <p className="mt-2 text-sm">Loading...</p>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={entityPath}
        className="h-full w-full border-0"
        title={`${getEntityLabel(panel.entityType)} - ${panel.title || panel.entityId}`}
        onLoad={() => setIsLoading(false)}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
      />
    </div>
  );
}

// Define the interface that was missing
interface SplitPanelPanelContentProps {
  panel: SplitViewPanel;
  side: "left" | "right";
  isSplit: boolean;
  onOpenSplit?: (panel: SplitViewPanel) => void;
}

/**
 * Button to toggle split view with a specific entity
 */
export function SplitViewToggleButton({
  entityType,
  entityId,
  title,
  variant = "outline",
  size = "sm",
  className,
  children,
}: {
  entityType: SplitViewEntityType;
  entityId: string;
  title?: string;
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children?: React.ReactNode;
}) {
  const { isSplitView, leftPanel, enterSplitView, setRightPanel, exitSplitView } = useSplitView();

  const handleClick = () => {
    const newPanel: SplitViewPanel = { entityType, entityId, title };

    if (isSplitView) {
      // If already in split view, exit split view
      exitSplitView();
    } else if (leftPanel) {
      // If we have a left panel, add this as right panel
      setRightPanel(newPanel);
    } else {
      // No panels yet, set this as left and user needs to select another for right
      // For now, we'll just enter split view with a placeholder on the other side
      // This could be enhanced with a selection dialog
      enterSplitView(newPanel, { entityType: "client", entityId: "select" });
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
    >
      {children || (
        <>
          <Columns2 className="mr-2 h-4 w-4" />
          Split View
        </>
      )}
    </Button>
  );
}

/**
 * Context menu item to open entity in split view
 */
export function OpenInSplitViewItem({
  entityType,
  entityId,
  title,
  onSelect,
}: {
  entityType: SplitViewEntityType;
  entityId: string;
  title?: string;
  onSelect?: () => void;
}) {
  const { isSplitView, leftPanel, enterSplitView, setRightPanel } = useSplitView();

  const handleClick = () => {
    const newPanel: SplitViewPanel = { entityType, entityId, title };

    if (isSplitView && leftPanel) {
      // Already in split view, update right panel
      setRightPanel(newPanel);
    } else if (leftPanel) {
      // Have left panel, enter split view
      enterSplitView(leftPanel, newPanel);
    } else {
      // No panels, set as left and need to pick right
      // For now just set left panel
      enterSplitView(newPanel, { entityType: "client", entityId: "select" });
    }

    onSelect?.();
  };

  return (
    <button
      className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent"
      onClick={handleClick}
    >
      <Columns2 className="h-4 w-4" />
      Open in Split View
    </button>
  );
}

/**
 * Hook to check if current page is being viewed in split view
 */
export function useIsInSplitView(): boolean {
  const [isInSplitView, setIsInSplitView] = React.useState(false);

  React.useEffect(() => {
    // Check if we're in an iframe (split view uses iframes)
    setIsInSplitView(window !== window.top);
  }, []);

  return isInSplitView;
}

export default SplitViewContainer;
